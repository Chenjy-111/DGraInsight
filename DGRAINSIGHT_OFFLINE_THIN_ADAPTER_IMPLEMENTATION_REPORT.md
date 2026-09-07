# DGraInsight Offline Thin Adapter Implementation Report

本轮目标已实现：用此前未接入的真实 AGCRN，经外部薄适配器调用原模型，完成关系删除、
重新预测、统一 MAE/MSE 证据和通用 Web 分析。没有把 MTGNN 当作新模型推广性证据。

## 1. Final architecture

原始模型 → 模型专用 Thin Adapter → 通用验证/执行/误差计算 → `evaluation.v1` → Generic Web。
保留已有函数接入与内置插件，不再让用户重写实验编排、指标、持久化和交互分析。
`dgrainsight` 只是清晰的公共命令名，复用 `dgraudit` 内现有 runner，没有第二套框架。

[核心依赖审计](docs/OFFLINE_CORE_DEPENDENCY_AUDIT.md)明确分为 Generic Core、Plugin Layer、
Specialized Web 和 Legacy。系统当前问题是：删除模型内部关系后，预测误差如何变化。
旧 controls / D / p/q / Supported 不属于新流程。

## 2. Adapter Contract

稳定接口版本 `thin-adapter.v1`，代码：[thin_adapter.py](dgraudit/thin_adapter.py)。
六项职责为 load、load_sample、predict、get_contexts、get_relations、
predict_with_intervention；可选 close。最后一个方法处理 identity / remove。

Sample 显式保留 id、原生输入和 truth；GraphContext 保留 id、kind、label 和可选 index；
Relation 使用 source/target 和可选 weight。图节点数与预测输出数独立。
Node semantics 为 observed / latent / custom。

## 3. Adapter vs Core responsibilities

Adapter 负责加载、原始 forward、图方向、原生插入点、归一化、自环、层/门/分支范围和干预。
Core 只接收样本、上下文、关系和预测，负责验证、排程、MAE/MSE、证据与复算。
Core 不改 adjacency，不根据模型名称猜消息方向，不复制模型 forward。

Capabilities 声明 single-context / all-context / native batch / directed / node semantics。
本轮 batch orchestration 为顺序多样本循环；不支持的范围明确报 NOT_SUPPORTED。
模型专用的 all-context 完整分组由 adapter 校验。

## 4. Three integration levels

| Level | 使用方式 | 必需工作 |
|---|---|---|
| 1 Result Import | 导出已有预测/指标并导入 Web | 对齐统一 schema 与误差尺度，无模型运行时要求 |
| 2 Thin Adapter | 六方法 class 或现有 FunctionBackend callbacks | 接通原模型、声明语义并实现有效原生干预 |
| 3 Built-in Plugin | 使用已维护 DGraFormer/MSGNet/MTGNN 插件 | 提供对应源码、数据和 checkpoint |

**Analysis compatibility** 是证据格式可分析；**Execution compatibility** 还要求模型关系
可识别、可正确干预、适配器和运行环境可用。这不等于自动支持所有 forecasting models。
相比用户独立编写整个删边程序，节省的是检查、循环、指标、证据和 Web 工作；模型特有干预仍需提供。

## 5. Validation pipeline

统一六项：Adapter Load、Sample Load、Baseline Forward、Relation Extraction、
Identity Intervention、Real Relation Removal。状态明确为 PASS / FAIL / NOT_SUPPORTED / UNAVAILABLE。
只有通过才运行。identity 为执行必需项，所有选定样本/context 都检查 atol=1e-6、rtol=1e-5。

有限输出与 identity PASS 均不能单独证明删边正确。adapter 的 graph-state 检查独立记录；
没有检查就写 unavailable。AGCRN 另有独立原生消费矩阵/预测一致性报告。
失败不返回 baseline 冒充干预结果，不替换关系，不将缺失变成零。

## 6. Evidence format

继续使用现有版本 `evaluation.v1`。自包含 JSON（可命名 manifest.json）内包含 metadata、
样本/context/关系、baseline/after MAE/MSE、原始 truth/prediction、errorChange 和逐步误差差值。
没有另建 archive 格式或强制伴随 NPZ；这保留 schema 并使单文件 Web 导入直接可用。

全部 forecast steps × outputs 求平均；Δ=after−before。相对改善分母为 0 时为 unavailable。
Python 和 Web 对数组、指标及已提供差值进行复算。只有 aggregate metrics 的导入保留分析，
但 per-output、forecast curves/step profiles 明确不可用。多样本 profile 按关系/context/scope 精确匹配。

结果：[AGCRN evidence](public/data/evaluation/agcrn.json)、[MTGNN reference](public/data/evaluation/mtgnn.json)。

## 7. Generic Web

复用 [EvaluationWorkspace](src/components/EvaluationWorkspace.tsx)：模型/来源/能力、样本、
context、关系表、MAE/MSE、scope、forecast-step profile、跨样本及 provenance。
原始数组不足时禁用相应视图；不足 2 个匹配样本不显示跨样本曲线。
超过 500 条关系的稠密图不画 SVG，使用可搜索关系表；证据仍保留全部关系。

已有 DGraFormer/MSGNet 专属界面和 performance.v1 资产保持。
AGCRN 没有新增专属 workspace、路由或模型分支。

## 8. Custom fixture test

[外部 class fixture](integrations/contract_fixture/adapter.py)为用户计划允许的确定性集成测试：
4 个 latent nodes、2 个 outputs、3 steps、2 samples；关系权重省略。
另有 signed graph 的函数 fixture。均清楚标为 synthetic / deterministic integration fixture，
不作为真实模型性能或推广性主证据。动态加载、identity、原生返回字典、缺失权重、错误样本、
不支持 scope 和错误 graph-state 均有测试；两种 fixture 都通过实际浏览器导入。

## 9. Real external-model experiment

[完整验证报告](docs/EXTERNAL_MODEL_ADAPTER_VALIDATION.md)。
官方 [LeiBAI/AGCRN](https://github.com/LeiBAI/AGCRN)，固定 revision
`7fbbf2aeb099242098a3cf482b55cd45d7295c28`。真实 PeMSD8 170 个节点，原生 Run.py 训练
1 epoch 小型配置；checkpoint 随集成代码保留，数据和源码有来源与哈希。

测试样本 0、1、2，关系 0→1 / 1→0 / 2→3，共 9 个真实预测。V1–V6 全 PASS。
独立验证检查 **54 次**实际 einsum 消费 support，9 次预测逐元素相同，最大差异 **0**。
未启用钩子的模型与从原始 Git revision 加载的原始 forward 完全一致。

## 10. External adapter diff

[AGCRN adapter](integrations/agcrn_external/agcrn_adapter.py)124 行，非空 112 行；
六个接口方法，少量加载和图状态检查辅助函数。没有复制模型 forward。

原模型改动有明确 [patch](integrations/agcrn_external/native_hook.patch)：
AVWGCN 中增加 2 行 optional hook；原生训练器 2 处强制 CUDA 改成配置 device。
source-before/source-after 语义和 pristine forward 比较已记录。薄并不意味着零适配成本。

## 11. Core files unchanged / changed

基线：`7c25aefda09959b2c9a157e4b5f353be5b25236b`，message `BEFORE_EXTERNAL_MODEL`。
从该提交到 AGCRN 集成，检查整个 dgraudit、dgrainsight、src、schemas、package.json，
包含 **116 个已跟踪文件**，核心改动 **0**。loader 与已有 plugin 层也在检查范围内。

[机器可读证明](integrations/agcrn_external/core_freeze_validation.json)记录路径、哈希、无变化结果。
基线检索中不存在 AGCRN 接入记录；MTGNN 不充当新模型。

```powershell
git diff 7c25aef HEAD --name-only
git diff 7c25aef HEAD --name-only -- dgraudit dgrainsight src schemas package.json
```

后者应为空。核心建立阶段允许通用修复；外部实验阶段没有新增 model-specific Core logic。

## 12. Test commands and outputs

| 实际运行 | 结果 |
|---|---|
| `npm run test:evaluation` | 10 evaluator + 6 thin-contract tests PASS；TS schema/metric regression PASS |
| `python -m dgrainsight validate configs/evaluation_agcrn_external.json` | V1–V6 PASS；graph-state passed |
| `python -m dgrainsight run configs/evaluation_agcrn_external.json --output public/data/evaluation/agcrn.json` | 3 baselines / 9 removals completed |
| `python integrations/agcrn_external/verify_native.py` | pristine forward PASS、54 matrices PASS、max prediction diff 0 |
| `python -m dgraudit validate-results public/data/evaluation/agcrn.json` | Schema、raw metrics、profiles PASS |
| `node tests/evaluationBrowserRegression.mjs` | MTGNN、函数 fixture、class fixture、缺失/无效导入、返回 built-in PASS |
| `node tests/agcrnExternalBrowser.mjs` | 真实 AGCRN 通用 Web PASS，3 sample MAE rows checked，0 page errors |
| `npm run test:performance` | DGraFormer 44 samples / 3073 cases，MSGNet 18 / 3024，PASS |
| `npm run test:web-graph-regression` | DGraFormer、MSGNet、MTGNN PASS |
| `npm run test:web-session-v2`（科学计算运行时） | 既有 Session v2 Web 导入回归 PASS |
| `npm run build` | TypeScript + Vite production build PASS；存在 bundle-size 提示 |
| `python integrations/agcrn_external/test_cross_entry.py` | MTGNN 3 samples / 84 records import/export 数值完全一致 |
| 扩展旧 `test_*adapter.py` | 10 tests 中 9 PASS、1 已有 Legacy assertion FAIL，见下文 |

默认系统 Python 3.14 没有 NumPy/Torch；旧测试初次会因依赖缺失失败。模型和旧数值测试
实际使用本机 Python 3.12 的科学计算运行时，结果中记录其版本。

**已知历史失败**：`test_audit_core_contains_no_fixture_or_model_name_special_case` 禁止
`adapter_id ==` 字符串，旧 quick_audit / edge_discovery 已有 MSGNet 图节点命名/语义分支。
与本轮之前的 `58c7d04` 比较，相关三个文件及测试逐字不变。未通过删改测试掩盖失败；
不声称全仓所有历史测试通过。该失败与本轮新通用路径无关，证据在 core freeze JSON。

## 13. Compatibility matrix

| 入口 / 模型 | Analysis | Execution | 节点语义 / 范围 | 证据 |
|---|---|---|---|---|
| 用户已有 results | schema 合法即可 | 不要求 | 可无图、无 raw arrays；相应视图 unavailable | metrics-only tests |
| 外部 deterministic fixture | YES | YES | 4 latent nodes / 2 outputs；single | 16 unit tests + browser |
| DGraFormer maintained plugin | YES | 指定架构/源码/数据/checkpoint | observed、effective windows、single/all | 真实本地运行 + 原 performance/graph 回归 |
| MSGNet maintained plugin | YES | 指定架构/源码/数据/checkpoint | latent graph positions、layer/scale、single/all scales | 真实本地运行 + 原 performance/graph 回归 |
| MTGNN maintained plugin | YES | 当前 learned-graph single-step 配置 | observed；共享图和 transpose 分支耦合干预；single | 84 removals、1680 matrices、native max diff 0 |
| AGCRN external adapter | YES | 本次小型 checkpoint 配置 | observed；gate+update 全 encoder steps；single | 9 removals、54 matrices、generic Web |
| 任意无明确关系/干预的模型 | 有合法 results 时可分析 | 不自动支持 | 需要用户补充有效 adapter，不能泛化承诺 | 范围边界 |

## 14. Known limitations

- 外部实证为一个新架构、一个 checkpoint、3 个相邻样本和 3 条关系，不是广泛模型 benchmark。
- AGCRN 原 loader 用全数据拟合 scaler 后分割；保留原生一致性，明确不声称无泄漏性能评测。
- 删除的是模型内关系；row renormalization、递归、其他路径仍可能影响输出，不是现实因果证明。
- 需要模型专用干预代码和兼容运行时。当前 all-context 支持由具体 adapter 决定。
- 证据为自包含 JSON，AGCRN 稠密图约 12.3 MB；暂无压缩 archive 或复杂 batch scheduler。
- 通用 Web 展示 producer 提供的验证信息；不在浏览器重新执行模型。报告给出独立 native 检查。
- 原 Legacy assertion 失败如实保留，旧审计体系不因本次迁移被重写。

## 15. Paper claim–evidence matrix

| 可支持表述 | 证据 | 不应扩张成 |
|---|---|---|
| Compatible new models can be integrated through thin model-specific adapters | AGCRN 124-line adapter，原 forward，9 real interventions | 自动兼容任意模型 |
| No model-specific core rewrite was needed in the external-model study | BEFORE_EXTERNAL_MODEL + 116-file empty core diff | 原模型不需任何 hook/环境工作 |
| Shared evidence supports model-independent analysis | AGCRN / MTGNN / fixture 同 schema 同 Web | 不同模型的删边语义完全相同 |
| Model-native interventions are checked before analysis | identity + native support inspection + exact prediction comparison | learned relation 是现实因果边 |
| Users can reuse existing results or connect native execution | 3 integration levels，cross-entry exact metrics | 用户无需实现任何模型特有代码 |

验收 Q1–Q8：

| 问题 | 结论 | 实际证据 |
|---|---|---|
| Q1 稳定 Thin Adapter Contract | YES | thin-adapter.v1、六方法、冻结 commit |
| Q2 动态外部 Adapter | YES | external module/class config，AGCRN 无 registry 分支 |
| Q3 真实模型 baseline forward | YES | 3 native baselines，preflight V3 |
| Q4 真实 relation removal 重新预测 | YES | 9 records、54 consumed-support checks |
| Q5 identity intervention | YES | max difference 0，V5 + 每个选定样本 |
| Q6 无新增 model-specific Core logic | YES | 116 files checked，changedCoreFiles=[] |
| Q7 统一 MAE/MSE Evidence | YES | evaluation.v1、raw arrays、sample/step profiles |
| Q8 无专属 Web 进入 Generic Web | YES | Edge browser report，existing EvaluationWorkspace |

## 16. Video-ready workflow

1. 打开 `integrations/agcrn_external/agcrn_adapter.py` 和 config，展示六方法与 source/target 语义。
2. 运行 `python -m dgrainsight validate configs/evaluation_agcrn_external.json`，展示六项 PASS。
3. 使用新的输出路径运行 `python -m dgrainsight run configs/evaluation_agcrn_external.json --output outputs/video_agcrn/manifest.json`。
4. 网页点 **Import Evaluation Results**，导入刚输出文件；独立 verified 演示可直接导入 `public/data/evaluation/agcrn.json`。
5. 选择 sample 0、关系 Sensor 0→Sensor 1；显示 baseline MAE 20.367393583、after 20.367984069，
   ΔMAE 0.000590485。切换 MSE、forecast output、sample，展示逐步和跨样本曲线。
6. 打开 provenance，区分 identity、adapter graph-state 和独立 native verification。
7. 展示 `git diff 7c25aef HEAD --name-only -- dgraudit dgrainsight src schemas package.json` 为空。

本机已有模型运行时（在项目根目录的 PowerShell 设置一次，然后用 `& $evalPython` 替代 python）：

```powershell
$evalPython = 'C:\Users\cj\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:PYTHONPATH = "$PWD\.tmp\science-runtime;$PWD\.tmp\science-extra;$PWD"
& $evalPython -X utf8 -m dgrainsight validate configs/evaluation_agcrn_external.json
```

新电脑先准备兼容 Python/PyTorch/NumPy，再运行 integration README 中的 prepare 命令。
不要覆盖已存在的证据；runner 会拒绝意外覆盖，可选择新路径或显式 --resume。

## 17. Git status

核心基线提交 `7c25aef`（BEFORE_EXTERNAL_MODEL），后续外部实验提交单独保存。
外部阶段新增 integration/config/evidence/test/report，核心路径无差异。
用户原有的三份未跟踪文档未编辑、未提交：
`AAAI27_DEMO_PROJECT_BRIEF.md`、`DGRAINSIGHT_PROJECT_BOOK_CN_2026-09-07.md`、
`DGRAINSIGHT_REPORT_SCRIPT_CN.md`。第三方源码、真实原始数据和临时截图/实验输出仍在忽略目录；
可复现脚本、原生 patch、checkpoint、正式结果和报告已保留。
