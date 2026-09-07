# External Model Adapter Validation

## 实验结论

AGCRN 通过外部六方法 Thin Adapter 接入。真实 PeMSD8 测试样本 0、1、2 上，
3 条指定关系各运行一次，得到 9 个真实删边结果；通用核心与 Web 在冻结后没有修改。
所有结果来自本地 CPU 原生执行，未生成、替换或推测实验数据。

## 新模型选择与可行性

- 模型：[LeiBAI/AGCRN 官方仓库](https://github.com/LeiBAI/AGCRN)，NeurIPS 2020。
- 固定 revision：`7fbbf2aeb099242098a3cf482b55cd45d7295c28`。
- BEFORE_EXTERNAL_MODEL 的已跟踪 core/config/integration/docs/Web 中搜索 AGCRN 无匹配；
  它不是重命名 MTGNN 或复用已有 MTGNN backend。
- AGCRN 的 learned support 在 AVWGCN 内部生成，原生 forward、数据加载和训练均可复用。
- 克隆仓库的 data 目录实际只有占位文件；随后从官方 README 指向的
  [ASTGCN 数据源](https://github.com/Davidham3/ASTGCN-2019-mxnet/tree/master/data/PEMS08)
  下载真实 `pems08.npz`，未采用合成数据。
- 原生训练器有两处强制 `.cuda()`；改为已配置 device 后 CPU 原生训练成功。

## 数据、训练与 checkpoint

| 项目 | 实际值 |
|---|---|
| 数据原始 shape | 17856 × 170 × 3；原生加载器取第 0 通道 flow |
| 数据 SHA256 | `e1d03ce74e9fb79149e6e7c37c680214822c4a285baa2f42278cacabcd25c075` |
| 原生分割 | chronological 60% / 20% / 20% |
| 原生窗口数 | train 10709、validation 3566、test 3566 |
| 实际训练 | 原生 Run.py / Trainer，1 epoch，seed 10，Adam lr 0.003，batch 64 |
| 小型配置 | lag 3、horizon 3、170 nodes、rnn_units 8、embed_dim 4、1 layer、cheb_k 2 |
| 参数数量 | 2531 |
| checkpoint | `integrations/agcrn_external/checkpoint.pth`，13624 bytes |
| checkpoint SHA256 | `931f3c316158b2abf22a311e50fe14713dfd09cc685dc0956d11530dd4c15932` |
| Runtime | Python 3.12.14、PyTorch 2.14.0+cpu、CPU，2 threads |
| 误差尺度 | 原生 scaler.inverse_transform 后的 flow 单位，MSE 为平方单位 |

checkpoint 为本次真实训练产物，不是官方提供的 pretrained weights，也不声称复现论文精度。
原生 scaler 在完整数据上拟合后再切分，这是原项目的预处理方式；本实验保留该行为，
明确限制为接入验证，不宣称无数据泄漏的性能评测。原生训练日志保存在 integration 目录。

## 薄适配器与原代码修改

`agcrn_adapter.py` 共 124 行，非空 112 行，含 6 个接口方法及少量加载/检查辅助代码。
没有复制模型 forward、图卷积、训练循环或数据预处理实现。

`native_hook.patch` 完整记录原仓库差异：

1. `model/AGCN.py` 加 **2 行**可选 support_override 钩子，在 softmax 后、Chebyshev support 构造前调用。
2. `model/BasicTrainer.py` **2 处** `.cuda()` 改为 `.to(self.args.device)`，使原生训练器可在 CPU 运行。

钩子未启用时，使用 `git show <source revision>:model/AGCN.py` 动态加载的原始 forward 与修改后
正常 forward 在全部 3 个选定样本上逐元素相同。没有替换整个 forward，也没有在 Core 注入矩阵操作。

## 干预语义

`knm,bmc->bknc` 的原生矩阵为 `[target, source]`。对 `encoder:0` 中 gate 和 update 的
全部 3 个 recurrent steps，将指定 learned support 条目置零并重新归一化该行。
其他行保持不变；原生 Chebyshev identity support 保持不变。当前阶数是 2。
保留项的归一化、递归状态和间接路径仍可能传递信息；不是隔离一条现实因果渠道。

single-context 支持；all-context、isolated-gate、native vectorized batch 不支持。
多样本由通用 runner 顺序执行。不支持的范围不会被自动替换。

## 六项 preflight

`integrations/agcrn_external/preflight.json`：V1–V6 全部 PASS。
包括真实 baseline、28,730 条非自环可选关系、identity replay、实际删除重新预测。
identity 最大差异为 0，统一容差 atol=1e-6、rtol=1e-5。
adapter 每次检查 6 个原生 support 钩子调用，删除条目为零、行归一化和其他行不变。

## 独立 native verification

`verify_native.py` 不调用 adapter 的删除 helper；独立构建掩码并运行原生 model forward。
直接检查原生 `torch.einsum` 输入，而不只检查导出的图：

- 原始 forward 等价检查：3 个样本 PASS。
- 9 次干预 × 6 个 gate/update/timestep = **54 次消费矩阵检查 PASS**。
- identity support 未改变，消费矩阵等于独立计算的删除/归一化矩阵。
- 9 个预测与通用 runner 输出逐元素相同，最大差异 **0**。
- 所有删除均有非零预测变化；最大单元素变化介于 0.00378418 与 0.287201。

报告：`integrations/agcrn_external/native_validation.json`。
这项验证和普通 identity PASS 是不同证据，不把有限输出或零响应自动当作删除正确。

## 真实误差结果

每个数值均由保存的原始 truth/prediction 重新计算。所有 3 steps × 170 outputs 取平均。
Δ = after − before；负值表示本次预测误差降低。下表打印精度有限，完整精度在 JSON 中。

| Sample | Relation | Baseline MAE | After MAE | ΔMAE | ΔMSE |
|---|---|---:|---:|---:|---:|
| 0 | 0 → 1 | 20.367393583 | 20.367984069 | +0.000590485 | +0.007760334 |
| 0 | 1 → 0 | 20.367393583 | 20.367967718 | +0.000574134 | +0.049144535 |
| 0 | 2 → 3 | 20.367393583 | 20.367397563 | +0.000003979 | +0.000172205 |
| 1 | 0 → 1 | 20.219878866 | 20.220505419 | +0.000626553 | +0.014322070 |
| 1 | 1 → 0 | 20.219878866 | 20.219335369 | -0.000543497 | +0.018198182 |
| 1 | 2 → 3 | 20.219878866 | 20.219868335 | -0.000010532 | -0.001622977 |
| 2 | 0 → 1 | 19.679123867 | 19.679387770 | +0.000263902 | +0.010447559 |
| 2 | 1 → 0 | 19.679123867 | 19.677718727 | -0.001405140 | -0.112917356 |
| 2 | 2 → 3 | 19.679123867 | 19.679181402 | +0.000057535 | +0.006488044 |

每条记录另有逐 forecast-step 的 ΔMAE/ΔMSE；跨样本只连接相同关系、context 和 scope。
微小变化可能在 Web 的 0.1% 描述阈值下显示 No noticeable change，这不意味着没有运行，
也不是统计显著性检验。

## Generic Web 与跨入口一致性

`tests/agcrnExternalBrowser.mjs` 在真实 Edge 浏览器上传同一结果，验证 3 个样本的 MAE 行、
context、relation table、output、误差曲线和 provenance；无页面错误。
复用 `EvaluationWorkspace`，没有 AGCRN 专属路由或组件。170 节点的稠密图不画 SVG，
使用冻结前已有的关系搜索表；完整关系仍保存在证据中。

另用已知 MTGNN 的 3 samples / 84 records 验证 result import/export 数值完全一致，
其报告为 `cross_entry_validation.json`。MTGNN 仅为已集成 reference plugin。

## 核心零改动证明

基线 commit：`7c25aefda09959b2c9a157e4b5f353be5b25236b`，message `BEFORE_EXTERNAL_MODEL`。
`core_freeze_validation.json` 核对 116 个文件，范围包含整个 dgraudit、dgrainsight、src、
schemas 和 package.json；changedCoreFiles = []。该范围也覆盖 loader 与已有插件层，
没有通过缩小 Core 定义排除新分支。

```powershell
git diff 7c25aef HEAD --name-only
git diff 7c25aef HEAD --name-only -- dgraudit dgrainsight src schemas package.json
```

第二条应为空。外部新增部分只有 integration、配置、证据、验证测试和实施报告。

## 限制与已知失败

这是一个真实模型、一个 checkpoint、3 个相邻测试样本、3 条指定关系的接入研究，
不足以证明所有架构自动兼容、删边普遍提升精度或现实因果解释。
需要用户提供模型专用干预和运行环境；当前 adapter 仅覆盖上述 AGCRN 配置。

扩展旧测试运行时发现 Legacy 的 `test_audit_core_contains_no_fixture_or_model_name_special_case`
失败。其检查的 quick_audit / edge_discovery 本来已有 MSGNet 分支；与原始提交 58c7d04
逐文件比较均未改变。此历史失败不在本轮新执行路径，未为得到全绿结果而删改测试。
新流程测试及要求的 performance.v1 / graph semantics 回归通过。
