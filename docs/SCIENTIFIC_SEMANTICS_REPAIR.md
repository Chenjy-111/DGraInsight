# 删边科学性核验与修正（2026-09-06）

本文记录原生图语义与归档预测的复验结果。当前网页性能结果来自独立的 `performance.v1` 运行，见 [性能数据说明](PERFORMANCE_V1.md)；下述历史复验失败仍保留，不能用新运行将其改为通过。

## 已确认和修正

- DGraFormer 原生 `nconv` 的 `bnsc,bnms->bmsc` 使用 `A[source,target]`。图节点对应原始变量通道。适配器在图生成后、图卷积使用前删除边并重新归一化，随后执行原模型的预测和反归一化路径。
- MSGNet 原生 `nconv` 的 `ncwl,vw->ncvl` 使用 `A[target,source]`。旧接口把原生行列误称为 source/target，导致页面箭头相反。现在公共图统一转为 `[source,target]`，删边明确修改原生 `[target,source]`，仍由原生 mixprop 加自环、归一化并执行完整模型。
- MSGNet 图上的 7 个位置来自 DataEmbedding 和 start_conv，不具有 HUFL/HULL/OT 等原始变量的一一对应关系。图节点已改为 G0–G6；预测曲线仍使用真实输出变量，单独选择。不能将 G0→G1 解释成传感器之间的关系。
- MSGNet 尺度不等于三个连续时间窗口；预测图去掉了人为等长窗口和 patch 标记，3D 视图使用从 0 开始的 scale_index。
- 删除后会重新归一化相关连接。MSGNet 的尺度图卷积在原模型中顺序执行，单尺度干预可传到后续尺度；单尺度指注入位置，不代表所有后续计算不受影响。

历史 MSGNet 数据使用明确的坐标迁移：转置图矩阵，交换 relation/candidate 的 source/target，改节点名称，交换 control identity。历史 case/candidate ID 和文件名保留为追溯键，其中旧 `edge:a->b` 表示历史原生行列，真实消息方向为 G_b→G_a；页面取 source/target 字段，不能解析旧 ID 推断方向。2,352 份预测与原始 NPY 逐项精确相等。冻结导出和新 quick audit 均使用修正后的语义；未标注新版语义的 MSGNet 导入会被拒绝，避免继续展示旧命名。

## 真实前向复验结果

使用原始 CSV、匹配 SHA-256 的 checkpoint，以及本地原模型源码，在独立进程运行 Python 3.12 / PyTorch 2.14.0+cpu。全程没有放宽预先设置的 `atol=1e-5, rtol=1e-5`。

| 项目 | DGraFormer | MSGNet |
|---|---:|---:|
| 基线样本 / 删边案例 | 40 / 361 | 14 / 2,352 |
| 不改变图的空操作与原前向最大差异 | 0 | 0 |
| 与历史基线最大绝对差异 | 1.90735e-6 | 2.11358e-4 |
| 与历史删边预测最大绝对差异 | 2.14577e-6 | 3.30053e-4 |
| 历史数值复现 | PASS | **FAIL（保留失败）** |
| MAE / MSE 变化方向反转案例数 | 0 / 0 | 76 / 70 |

MSGNet 另做了独立原生对照：直接在原模型 mixprop 的 forward_pre_hook 修改它自己算出的邻接矩阵，不调用适配器图生成/删边逻辑。2,352 个案例与修正适配器的完整预测**精确相等**。每个受影响尺度实际进入原生 nconv 的矩阵，也通过了删边、自环和归一化检查。14 份历史输入与真实值都逐项精确一致。

因此，已确认 MSGNet 修正后删除的是选定内部位置之间的连接，并通过原模型得到预测；但不能宣称历史预测已在当前环境严格复现。历史记录注明 Python 3.9.13 / PyTorch 2.1.1+cu121 / CUDA 12.1。版本与设备不同是已知差异，**尚未实验证明数值偏差完全由它们造成**。每案例 MAE/MSE 变化的最大复验差异约为 1.12e-5 / 1.56e-5；部分接近零的变化反向。页面已标明数值来自历史运行、当前复现未通过；不能把这些微小升降当成跨环境已确认的收益。

DGraFormer 的 40 份真实值一致；Session 只存有 1 份可对照的 history，其余 39 份 history 在该 Session 中不可用。它们仍通过原生 dataset 从已核验的 CSV 读取，且所有预测复现通过。没有补造缺失的历史输入记录。

完整结果：`scientific_validation/dgraformer_replay.json`、`scientific_validation/msgnet_replay.json`。MSGNet 报告保留所有失败案例及方向反转的历史/复验误差变化。

## 可重复执行与验证

`scripts/verify_intervention_replay.py` 接受 `--model`、`--source-root`、`--data-path`、`--checkpoint`、`--output`。每个模型必须单独进程执行，避免原仓库同名 Python 包混用。脚本只写核验报告，不更新预测；遇历史复现失败返回非零。

已通过：Python 的 Pipeline v2、MSGNet 适配器、干预及语义回归；Session v2 前端校验（包含拒绝旧方向/错误变量名）；自定义适配器导入；三模型图数据回归；生产构建。构建通过不代表上述 MSGNet 历史数值复现通过。

若要声称历史 MSGNet 预测严格可复现，仍需在匹配环境中通过原声明容差的复验。当前独立性能运行不构成对历史预测的严格复现。

## 归档 Session 的微小变化展示规则

归档结果采用基线误差的 **0.1%** 作为“未发现明显变化”的相对阈值。MAE/MSE 各自比较 `|after − baseline| ≤ threshold`（边界包含在内）。当前这批冻结 MSGNet Session 使用 `max(0.001 × baseline, 0.00002)`；绝对下限依据本次观察到的 MAE/MSE 变化复验偏差向上取整，仅匹配该 Session、checkpoint 和 CSV，不自动用于其他模型或导入数据。其他数据使用相对阈值。

该规则是可调整的描述性展示选择，不是统计显著性检验、等效性检验或未来运行误差上界。“未发现明显变化”不意味着零变化。原始误差、变化量、百分比、预测数组均保持不变；先对原始值求均值，再对均值分类，各时间样本也用自身基线独立分类。

两项指标均在阈值内时，总标签为 No noticeable change；两项均超过阈值且同方向时才显示 Improved/Degraded；只有一项超过阈值时显示 One metric improved/degraded；两项超过阈值且方向相反时显示 Mixed。缺少基线不能计算相对阈值，分类为 Unavailable，不当作零变化。基线为零时相对百分比仍不可用。

新增回归核对了阈值边界、缺失值、零基线、均值抵消、模型范围和数据不变性。本次报告中所有 146 条指标方向反转记录，两端变化均落在 0.00002 下限内。历史 MSGNet 数值复现的 FAIL 状态仍保留。
