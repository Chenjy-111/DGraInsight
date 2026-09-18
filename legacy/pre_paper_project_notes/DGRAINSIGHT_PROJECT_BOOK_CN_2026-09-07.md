# DGraInsight 更新后项目工程书

> 用途：交给 ChatGPT 网页版或其他论文写作助手，快速、全面理解当前项目，建立论文论点与工程证据之间的对应关系。
>
> 整理日期：2026-09-07。依据本地已提交代码、数据、提交记录和本次检查，不是沿用旧版项目简介。
>
> 工程快照：`58c7d04e00e5ff579430ebff0d757cb5e68264b1`，提交时间 2026-09-06，标题 `Add versioned forecast performance results and simplify model views`。
>
> 整理结束时检测到工作区出现新的未提交代码改动，未纳入本次核对范围；本书描述上述已提交快照，不代表之后持续修改中的工作区。
>
> 本次写作范围：当前网页系统、模型图语义、删边性能结果、近期更改、工程结构和论文素材导航。**后续计划补充一个 offline 模块，具体设计仍待讨论，本工程书不展开，也不将其计入本次论文的已完成贡献。**

## 1. 给网页版的项目定义

DGraInsight 是一个面向多变量时间序列预测模型的交互式图关系分析系统。它把模型学到的图结构、用户选定的有向关系、明确的删边范围以及删边前后的预测误差联系起来，使研究者能够检查：某条模型内部连接被移除后，预测准确度如何变化，这种变化在不同预测步、不同测试样本和不同图上下文中如何分布。

当前最准确的主线是：

**看图 → 选择真实有效的有向边 → 比较单上下文与全部相关上下文的删除 → 查看 MAE/MSE 与误差变化轨迹。**

系统使用已保存的真实模型运行结果。浏览器负责加载、验证、组织和展示这些结果，并计算展示所需的均值、差值与百分比；用户点击一条边时，浏览器不会即时运行神经网络。

当前内置网页工作区有两个模型：DGraFormer 和 MSGNet，均围绕 ETTh1、96 步预测开展展示。项目不是提出一个新的预测网络，也不是把学习到的边直接解释成现实世界的因果关系。论文贡献应主要落在图语义对齐、关系与结果的准确对应、删除范围比较、交互分析及可追溯结果组织上。

仓库还保留旧版 Session v2、正式统计审计与适配器相关实现，供历史追溯。它们的存在不意味着当前新版 Summary 仍以旧版审计结论作为数据来源。

## 2. 本次最重要的新更改

以下“之前/现在”以现有旧文档、历史实现和最新提交为依据。“之前”不表示每项改动都只发生在上一条提交中。

| 更改 | 之前的状态或问题 | 现在的实现 | 对论文的影响 |
|---|---|---|---|
| 项目展示重心调整 | 旧工程简介以匹配对照、D、Supported 和 p/q 值为主要叙事 | 内置结果区改为单一性能 Summary，重点比较删边前后 MAE/MSE | 摘要与演示流程必须围绕当前性能比较重新写 |
| 独立性能数据版本 | 旧 Session 承载历史审计结果 | 新增 `performance.v1`，单独保存两模型的性能数据 | 新版性能数值不能从旧 Session 的统计结果拼接 |
| 全量生成新版配对结果 | 历史冻结样本和网页展示样本覆盖不完全一致 | 覆盖原冻结样本及额外网页样本；每模型统一运行环境生成基线和删除预测 | 能准确说明当前结果覆盖范围，而非笼统说“大量实验” |
| MSGNet 图方向修正 | 原生矩阵的行列曾被直接误称为 source/target | 公共图用 source→target，原生删除位置为 `A[target, source]` | 页面箭头方向与实际模型消息传播对齐 |
| MSGNet 节点解释修正 | 7 个内部图位置曾被对应到原始传感器变量 | 改名为 G0–G6；预测输出仍用 HUFL 等真实变量名 | 避免把潜在内部位置误解释成具体传感器 |
| MSGNet 尺度解释修正 | 容易把不同尺度画成连续时间窗口 | 明确使用 `scale_index`；预测图去除人为等长窗口与 patch 标记 | 尺度、输入窗口和预测步必须在论文中分别定义 |
| 有效边与上下文联动 | 选择状态可能与当前图或结果不一致 | 根据实际有效边生成选项；样本切换时有效则保留，无效则清空提示 | 结果身份不被界面悄悄替换 |
| 结果组织简化 | 旧版多个解释或证据区块并存 | 当前关系结论、指标表、删除范围比较表、误差折线和折叠方法说明 | 降低观众理解一次删边实验的成本 |
| 误差图最终形态更新 | 文档早段曾描述柱图和默认跨样本视图 | 当前代码默认按预测步显示不平滑折线，可切换跨测试样本 | 论文截图和图注以最终代码为准 |
| 微小变化规则明确 | 小数变化容易被直接写成稳定收益 | 每项指标采用基线误差的 0.1% 描述性阈值 | 标签不是显著性检验，也不是零效应证明 |
| 结果可追溯性加强 | 单看网页 JSON 不足以独立检查所有指标 | 新增原始 NPZ 数组、哈希、运行参数和复算报告 | 为论文中的数据真实性与可核对性提供工程证据 |
| 加载与异常处理加强 | 边切换可能增加请求或混用旧结果 | 每模型缓存一个性能加载 Promise，身份不符或缺记录则显示不可用 | 不以旧结果、零值或另一条边替代缺失数据 |
| 主界面进一步收敛 | 较早版本包含注意力和额外解释面板 | 删除 `MultiScaleAttentionView`、`AttentionHeatmap`、`ExplanationInspector`、`CaseStudy` 等旧组件 | 不再把这些已移除面板列为当前在线功能 |

这次工作的核心不只是视觉改版，而是同时更新了“删的是什么”“结果从哪里来”“界面如何对应结果”和“怎样解释误差变化”。

## 3. 用户现在可以看到和操作什么

### 3.1 页面整体组成

`src/App.tsx` 组织当前页面：项目介绍、数据导入入口、研究动机、方法说明、工作流介绍、Pattern Discovery 主工作区、系统架构、解释边界及参考资料。

主工作区切换 DGraFormer 与 MSGNet。两者分别保留原生窗口图与尺度图的差异，并共用新版性能结果组件。

需要注意：页面部分介绍组件仍含有 response stability、matched controls、formal support 等旧叙事文字。**判断当前内置结果功能，应查看 `SessionV2Evidence.tsx` 实际调用的 `PerformanceSummary`，不能仅凭首页文案推断。** 本工程书没有修改这些界面文件。

### 3.2 DGraFormer 工作区

- 当前面板固定展示 ETTh1，预测长度为 96，支持 5 个网页样本入口。
- 预测视图可选择输出变量，查看历史输入、真实未来值和保存的预测曲线。
- 图视图提供 Matrix 与 3D timeline 两种布局。
- 用户可以选择图窗口、点击关系或通过关系按钮选边，查看选中高亮。
- 支持窗口播放、暂停、三维层间距调整、重置和显示状态导出。
- 选中边后，窗口下拉、Summary 上下文按钮、三维窗口按钮与播放序列依据该边的有效上下文收敛。
- 窗口面向用户从 1 开始显示，性能记录中的原生 context 索引从 0 开始。

“Export state”导出的是界面状态，不应写成导出了新模型或新预测实验。

### 3.3 MSGNet 工作区

- 当前为 ETTh1、96 步预测，图目录含 5 个网页样本。
- 预测视图选择真实输出变量；图视图选择内部图位置 G0–G6 之间的有向关系。
- 图布局包括 Matrix 和 3D scales，尺度索引为 0、1、2。
- 展示当前样本 FFT period、FFT strength、保存的 mixing weight 等尺度信息。
- 公共矩阵展示约定为“行 = source，列 = target”；只允许选择有效非自环关系。
- 样本、尺度、图选边和 Summary 的关系身份保持联动。

MSGNet 的尺度不是三个连续时间段。G0–G6 也不是 HUFL、HULL、MUFL、MULL、LUFL、LULL、OT 的别名。

### 3.4 新版唯一 Summary

选定有效关系后，结果区包含：

1. 当前关系、删除范围、测试样本、96 个预测步及 7 个输出变量的结果身份。
2. 当前样本的总体描述性结论。
3. MAE 与 MSE 的 Baseline、After removal、Improvement (%)。
4. 单窗口/单尺度与全部相关窗口/尺度的六列比较表。
5. 误差变化折线，支持 MAE/MSE 和两类横轴切换。
6. 默认折叠的 Data & methods，说明来源、公式、阈值、模型语义与环境。

两种误差横轴各回答一个问题：

| 模式 | 每个点代表什么 | 能说明什么 |
|---|---|---|
| By forecast step，当前默认 | 当前样本某个预测步的 7 个输出变量平均误差变化 | 同一次预测任务里，影响发生在哪些预测步 |
| Across test samples | 一个预声明测试样本内，96 步 × 7 输出的平均误差变化 | 同一关系及删除范围在不同测试任务中的变化分布 |

横轴使用真实数值索引；折线不平滑，有零参考线，缺失位置断开，不插补。可以点击点或用选择框查看对应的原始误差、差值和百分比。

预测视图中选择某个输出变量，不会把 Summary 自动改成该变量的专属指标；当前 Summary 聚合所有 7 个输出变量。这一点应写进图注或演示说明。

## 4. 两种模型的图语义与删除范围

| 维度 | DGraFormer | MSGNet |
|---|---|---|
| 原生上下文 | 模型图窗口 | 模型尺度 |
| 节点解释 | 模型原始变量通道顺序 | 嵌入与卷积之后的内部潜在图位置 |
| 页面节点名 | HUFL、HULL、MUFL、MULL、LUFL、LULL、OT | G0–G6 |
| 页面 source→target 对应原生位置 | `A[source, target]` | `A[target, source]` |
| 单上下文删除 | 选定原生窗口内删除指定有向边 | 指定尺度位置注入该有向边删除 |
| 全上下文删除 | 删除该边在全部相关有效窗口中的出现 | 删除该边在全部相关有效尺度中的出现 |

删除不是隐藏页面上的线，而是基于修改后的模型内部图得到新的预测。模型特有的自环、归一化与后续传播处理遵循实现的原生路径；相关连接会在删除后重新归一化。

MSGNet 多尺度图卷积顺序执行，因此“单尺度删除”限定的是干预注入位置，不表示后续尺度计算完全不受影响。

如果一条边只在一个上下文中有效，单上下文与全部相关上下文可以是等价操作。页面明确提示 Equivalent scopes，回归检查也核对两类记录的结果一致性。

不同模型的图层级和节点含义不同，所以系统支持统一的交互框架，但不能把同样的节点编号强行理解为跨模型相同的物理关系。

## 5. 数据覆盖范围与当前结果版本

### 5.1 performance.v1 的实际规模

以下数量已从当前 JSON 读取，并通过本次性能回归检查。

| 项目 | DGraFormer | MSGNet |
|---|---:|---:|
| 数据集 | ETTh1 | ETTh1 |
| 预测步数 | 96 | 96 |
| 输出变量数 | 7 | 7 |
| 网页图样本入口 | 5 | 5 |
| 新版基线记录 | 44 | 18 |
| 原冻结评估样本数 | 40 | 14 |
| 单上下文删边记录 | 1,892 | 2,268 |
| 全部相关上下文删边记录 | 1,181 | 756 |
| 删边记录合计 | 3,073 | 3,024 |
| 基线和删边合计的逐步 MAE/MSE 值 | 598,464 | 584,064 |

44 = 原冻结 40 个样本加 4 个不重复的网页样本；18 = 原冻结 14 个样本加 4 个不重复的网页样本。跨测试样本折线沿用 `evaluationSamples` 中的 40/14 个预声明样本，不自动把所有 44/18 个样本都视为原冻结评估集合。

两模型共 62 份基线和 6,097 条删除记录。它们是记录数量，不能当成 6,097 个独立受试对象或独立统计样本。

仓库仍保存 ETTh2、ETTm1、ETTm2、Weather 等较早样本素材，但新版 performance.v1 内置比较仅覆盖 ETTh1。不能据此声称当前新版性能模块已经完成五数据集系统评测。

### 5.2 同一次新版数据生成中的配对原则

新版本基线和删除预测来自同一模型 checkpoint、同一 CSV 和记录的统一环境，固定模型参数，不重新训练模型。

运行记录为 Python 3.12.14、PyTorch 2.14.0+cpu、CPU；生成脚本设置 2 个线程。所有新样本的不改变图的 identity 操作，与对应原始前向预测精确一致。

关键来源标识：

| 资产 | SHA-256 |
|---|---|
| DGraFormer checkpoint | `f6abbd4e9b32ae80851f42d5476069c41c66b900b181f9f24c56d445a1cead9f` |
| MSGNet checkpoint | `78cf820042156a3e7d30e137ad944b9fb9a079b3d50be4893b49d1567bb6309d` |
| ETTh1 CSV | `f18de3ad269cef59bb07b5438d79bb3042d3be49bdeecf01c1cd6d29695ee066` |

参数也保存在结果 JSON 的 `parameters` 中。DGraFormer 当前图构造使用 `current_epoch = 5`；不能从旧导出文档复制其他 epoch 设置来解释这批结果。

### 5.3 原始预测与网页误差的对应

新版 JSON 保存逐预测步、对输出变量求平均的 MAE/MSE，不是完整预测张量本身。完整基线、真实值与删除预测保存在：

- `artifacts/performance/v1/dgraformer_raw.npz`
- `artifacts/performance/v1/msgnet_raw.npz`

其中 `baseline`、`truth` 按 JSON 的 `samples` 排列，`prediction` 按 JSON 的 `records` 排列；另有 `sample_ids`。JSON 的 `rawArchive` 记录文件路径、SHA-256 和排列规则，`sourceHashes` 记录上游相关源码文件哈希。

`scripts/verify_performance_v1.py` 从这些数组重新计算误差。仓库保存的 `verification.json` 报告两模型全部误差值精确相等。这支持“网页指标可以由保存的数值操作数复算”，不等同于“已经在所有设备和依赖版本上重新运行模型并完全一致”。

### 5.4 预测浏览素材与新版性能结果应分别识别

预测浏览视图读取样本 JSON 或 MSGNet graph catalog 中的保存曲线；新版 Summary 读取独立的 performance.v1。加载器核对图、checkpoint、数据身份及有效边，避免关系混配，但不能据此把所有既有 Forecast 曲线称为新版 CPU 重跑预测。

论文中报告新版误差变化，应引用 performance.v1 及对应 NPZ；引用既有预测浏览曲线时，应标明它来自样本素材或 graph catalog。

## 6. 误差计算与标签解释

令真实值为 y，预测为 ŷ。对某一个测试样本，先在每个预测步对 7 个输出变量计算：

```text
MAE_t = mean_v |ŷ[t,v] − y[t,v]|
MSE_t = mean_v (ŷ[t,v] − y[t,v])²
```

Summary 的样本级 MAE/MSE 再对 96 个预测步求平均。由于每步输出数量相同，这等价于在该样本的 96 × 7 个位置上整体求均值。

页面误差使用模型标准化输出尺度，不应直接写成原始物理单位下的误差。

```text
误差变化 ΔE = 删除后误差 − 基线误差
改善百分比 = (基线误差 − 删除后误差) / 基线误差 × 100%
```

因此，误差变化图中正值表示变差，负值表示改善；Improvement (%) 正值表示改善。两者的正负号含义相反，写图注时必须明确。

每项指标的描述性阈值为 `0.001 × 该指标基线误差`，先计算原始误差均值，再判定类别：

- ΔE 小于负阈值：该指标改善。
- ΔE 大于正阈值：该指标变差。
- 落在阈值内，含边界：No noticeable change。

MAE/MSE 同时改善才给出总体 Performance improved，同时变差才给出 Performance degraded；只有一项越过阈值则明确标注该项；两项越过阈值且方向相反则为 Mixed metric changes。

缺失数据不补零。基线为零时改善百分比为 N/A。阈值只影响类别，不改变实际误差或折线高度。

**0.1% 是展示规则，不是 p 值阈值，不证明统计显著性，也不证明等效或真实零变化。** 当前 performance.v1 的 `thresholdFloor = 0`，不继承旧冻结 MSGNet 数据曾使用的 0.00002 绝对下限。

## 7. 可以直接用于演示的真实案例

以下数值由本次直接读取 performance.v1 的逐步误差并求均值得到，表格仅做显示舍入。不是挑选后声称全局最优的案例。

### 7.1 DGraFormer：同一关系的删除范围改变解释

测试样本 0，关系 HUFL → LUFL，原生 context 0，即页面 Window 1。指标均聚合 96 步 × 7 输出。

| 删除范围 | MAE | MSE | MAE 改善百分比 | MSE 改善百分比 |
|---|---:|---:|---:|---:|
| 基线 | 0.352042070 | 0.272098486 | — | — |
| 单 Window 1 | 0.352761811 | 0.273037211 | -0.204447% | -0.344994% |
| 全部相关窗口 | 0.351942571 | 0.271681067 | +0.028263% | +0.153408% |

按当前规则，单窗口删除是 Performance degraded；全部相关窗口是 MSE improved only，因为 MAE 的变化未超过 0.1% 阈值。

这个案例适合说明：同一条有向边在不同删除范围下可能表现不同；需要同时阅读范围、指标和阈值，不能只看图权重，也不能仅凭一个正百分比就写“整体改善”。

### 7.2 MSGNet：微小变化与潜在图位置

测试样本 0，关系 G0 → G1，scale_index 0。

| 删除范围 | MAE | MSE | MAE 改善百分比 | MSE 改善百分比 |
|---|---:|---:|---:|---:|
| 基线 | 0.376915027 | 0.324296361 | — | — |
| 单 scale 0 | 0.376966480 | 0.324410086 | -0.013651% | -0.035068% |
| 全部相关尺度 | 0.377122057 | 0.324697616 | -0.054928% | -0.123731% |

单尺度删除为 No noticeable change；全部相关尺度为 MSE degraded only。节点 G0/G1 只能解释为内部图位置，不能写为 HUFL/HULL 之间的传感器关系。

## 8. 当前科学核验状态

本次更新不仅修正页面标识，还做了模型原生路径检查。`docs/SCIENTIFIC_SEMANTICS_REPAIR.md` 和对应 JSON 报告记录：

- DGraFormer 历史基线和删边预测在声明容差下复验通过。
- MSGNet 修正后的适配器与独立原生干预对照的 2,352 个案例预测精确一致，支持删除位置与模型传播方向的实现正确性。
- MSGNet 历史预测在当前 CPU 环境下未通过原声明容差的重现检查，FAIL 状态保留。
- 历史版本/设备与当前版本/设备不同是已知差异，但尚不能断言数值偏差完全由这些差异导致。
- 新版 performance.v1 使用统一 CPU 环境重新生成成对基线与删除预测，不把这一新版本当作历史复验通过的证明。

因此可以说“当前新版结果具有配对一致的运行来源并可从原始数组复算”，不能说“全部历史模型结果已跨环境严格复现”。

## 9. 工程结构与职责

```text
DGraInsight/
├─ src/                         React/TypeScript 网页实现
│  ├─ App.tsx                   页面和工作区组织
│  ├─ components/               控件、预测视图、图视图和结果区
│  │  ├─ evidence/              当前 PerformanceSummary 等
│  │  └─ three/                 DGraFormer/MSGNet 三维图
│  ├─ data/                     结果类型、加载、身份与语义校验
│  ├─ store/                    样本、窗口/尺度与关系选择状态
│  └─ types/                    网页数据类型
├─ public/data/
│  ├─ performance/v1/           当前两模型性能 JSON
│  ├─ samples/                  已保存预测与图样本素材
│  ├─ models/msgnet/etth1/       MSGNet 图与预测目录
│  └─ evidence/                 历史 Session v2 文件
├─ artifacts/performance/v1/    新版原始数组与指标复算报告
├─ scripts/                     数据生成、复算和回归支持脚本
├─ tests/                       性能、图语义、导入及浏览器回归
├─ docs/                        当前说明与核验报告
├─ docs/history/                历史工程文档
├─ dgraudit/                    现存模型适配与历史审计代码
├─ configs/、schemas/           配置与格式约束
└─ .github/workflows/           网站构建部署配置
```

前端主要技术：React 18、TypeScript、Vite、Zustand、Tailwind CSS；ECharts 用于图表，Three.js 与 React Three Fiber/Drei 用于三维图。仓库还有 Cytoscape 等图相关依赖，具体使用以组件调用为准。

关键状态链：DGraFormer 使用 `useDemoStore` 管理样本、窗口及选中边；跨工作区关系身份由 `useWorkflowStore` 组织；MSGNet 根据统一关系身份同步样本与尺度。性能记录用 `(sample, context, source, target, scope)` 精确检索，全范围记录使用 `context = -1`。

`loadPerformance` 检查版本、模型、ETTh1 身份、哈希格式、96 步、7 输出、重复记录及删除关系有效性。图加载器还核对有效边方向、集合与权重。异步样本加载具有请求身份检查，防止较早请求覆盖较新的选择。

现有 Session v2 导入入口仍可查看图与来源，但没有独立新版性能数据时，性能区明确不可用，不回退使用旧审计结果。MTGNN 和自定义适配器相关代码虽存在于仓库，但当前内置 performance.v1 不包含第三个 MTGNN 性能工作区。

## 10. GitHub 上应查哪些材料

### 10.1 仓库位置与核实程度

仓库地址：[Chenjy-111/DGraInsight](https://github.com/Chenjy-111/DGraInsight)。

当前本地 HEAD、`origin/main` 和 `origin/codex/v2-only-public-release` 均记录为 `58c7d04e00e5ff579430ebff0d757cb5e68264b1`。本地普通 `main` 分支落后于该远程跟踪版本，因此不能以本地 `main` 指针判断最新项目状态。

本次尝试联网读取 GitHub，但网页抓取失败，Git HTTPS 和 API 请求也受当前环境限制。因此，下方给出的是**本地已跟踪、按远程跟踪信息应对应 GitHub 的文件导航**，不宣称本次已逐个验证线上文件可访问或远程没有继续更新。网页版应先核对在线提交；若 main 后续变化，以指定提交作为本工程书的稳定基准。

固定版本入口：[本工程书对应提交](https://github.com/Chenjy-111/DGraInsight/tree/58c7d04e00e5ff579430ebff0d757cb5e68264b1)。下列 main 链接适合快速阅读；精确引用时可将路径中的 `main` 换成上述完整提交哈希。

### 10.2 最快理解当前项目的阅读顺序

| 优先级 | GitHub 材料 | 应读取的内容 |
|---|---|---|
| 1 | [README](https://github.com/Chenjy-111/DGraInsight/blob/main/README.md) | 项目入口与新版 performance.v1 定位；注意后半部分仍介绍历史体系 |
| 2 | [PERFORMANCE_V1.md](https://github.com/Chenjy-111/DGraInsight/blob/main/docs/PERFORMANCE_V1.md) | 新版数据、Summary、范围、计算与验收；末尾 Display update 覆盖早段柱图描述 |
| 3 | [PerformanceSummary.tsx](https://github.com/Chenjy-111/DGraInsight/blob/main/src/components/evidence/PerformanceSummary.tsx) | 当前真正展示什么、默认横轴、聚合方法、标签与交互 |
| 4 | [performance.ts](https://github.com/Chenjy-111/DGraInsight/blob/main/src/data/performance.ts) | performance.v1 类型、加载验证、缓存、百分比和结论规则 |
| 5 | [SCIENTIFIC_SEMANTICS_REPAIR.md](https://github.com/Chenjy-111/DGraInsight/blob/main/docs/SCIENTIFIC_SEMANTICS_REPAIR.md) | MSGNet 方向、潜在节点、尺度修正与历史复验边界 |
| 6 | [App.tsx](https://github.com/Chenjy-111/DGraInsight/blob/main/src/App.tsx) | 当前页面入口、两模型工作区及导入分支 |
| 7 | [SessionV2Evidence.tsx](https://github.com/Chenjy-111/DGraInsight/blob/main/src/components/SessionV2Evidence.tsx) | 虽保留旧文件名，实际内置结果已调用新版性能组件 |
| 8 | [最新改版提交](https://github.com/Chenjy-111/DGraInsight/commit/58c7d04e00e5ff579430ebff0d757cb5e68264b1) | 用户本轮实际修改的代码、数据、文档和删除组件 |

### 10.3 数据、模型语义与测试导航

| 材料 | GitHub 入口 | 论文用途 |
|---|---|---|
| 两模型新版性能 JSON | [performance/v1](https://github.com/Chenjy-111/DGraInsight/tree/main/public/data/performance/v1) | 获取样本、上下文、关系、删除结果、参数和哈希 |
| 原始数组及复算报告 | [artifacts/performance/v1](https://github.com/Chenjy-111/DGraInsight/tree/main/artifacts/performance/v1) | 独立复算指标，核对 44/18 与 3,073/3,024 等数量 |
| DGraFormer 图与预测样本 | [samples](https://github.com/Chenjy-111/DGraInsight/tree/main/public/data/samples) | 预测与图浏览素材；其他数据集文件仅说明已有素材覆盖 |
| MSGNet 图目录 | [graph_catalog_v2.json](https://github.com/Chenjy-111/DGraInsight/blob/main/public/data/models/msgnet/etth1/graph_catalog_v2.json) | 潜在节点、尺度信息、保存预测与样本索引 |
| MSGNet 语义定义 | [msgnet_semantics.py](https://github.com/Chenjy-111/DGraInsight/blob/main/dgraudit/msgnet_semantics.py) | 图方向及旧坐标迁移依据 |
| 网页图语义常量 | [graphSemantics.ts](https://github.com/Chenjy-111/DGraInsight/blob/main/src/data/graphSemantics.ts) | 节点、方向和界面解释约束 |
| DGraFormer 控件 | [ControlStudio.tsx](https://github.com/Chenjy-111/DGraInsight/blob/main/src/components/ControlStudio.tsx) | 当前可操作内容与显示状态导出 |
| MSGNet 工作区 | [MsgnetWorkspace.tsx](https://github.com/Chenjy-111/DGraInsight/blob/main/src/components/MsgnetWorkspace.tsx) | 预测变量和图节点分离、尺度与关系选择 |
| 三维图实现 | [components/three](https://github.com/Chenjy-111/DGraInsight/tree/main/src/components/three) | 三维窗口/尺度浏览与交互 |
| 新版数据生成脚本 | [export_performance_v1.py](https://github.com/Chenjy-111/DGraInsight/blob/main/scripts/export_performance_v1.py) | 已展示数值的生成依据，不将脚本本身写成新增用户模块 |
| 指标复算脚本 | [verify_performance_v1.py](https://github.com/Chenjy-111/DGraInsight/blob/main/scripts/verify_performance_v1.py) | 从真实值和预测数组计算 MAE/MSE 的依据 |
| 历史重现详细报告 | [scientific_validation](https://github.com/Chenjy-111/DGraInsight/tree/main/docs/scientific_validation) | DGraFormer PASS 与 MSGNet FAIL 的证据 |
| 性能逻辑回归 | [performanceRegression.mjs](https://github.com/Chenjy-111/DGraInsight/blob/main/tests/performanceRegression.mjs) | 公式、阈值、缺失、记录唯一性、等价范围和有效窗口 |
| 性能浏览器回归 | [performanceBrowserRegression.mjs](https://github.com/Chenjy-111/DGraInsight/blob/main/tests/performanceBrowserRegression.mjs) | 图选边、控件联动、缓存和错误版本处理的检查定义 |
| 工程依赖和命令 | [package.json](https://github.com/Chenjy-111/DGraInsight/blob/main/package.json) | 前端技术栈与可执行检查 |
| 历史工程档案 | [docs/history](https://github.com/Chenjy-111/DGraInsight/tree/main/docs/history) | 了解演进，不将旧阶段结论直接描述成当前状态 |

大型 JSON 或 NPZ 可能无法在 GitHub 页面完整预览。网页版应使用 GitHub 的 Raw/下载入口或仓库读取能力获取原文件；读取失败时应明确提出缺少哪份材料，不根据文件名猜测结果。

### 10.4 哪些东西不能默认从在线仓库得到

- 原始第三方数据集、用户本地模型 checkpoint、完整上游模型源码目录和本地运行环境不包含在当前发布说明所列资产中。结果中的哈希是来源标识，不是权重文件本身。
- 临时运行、未提交用户会话及被 `.gitignore` 排除的本地素材不能默认在线可见。
- `AAAI27_DEMO_PROJECT_BRIEF.md` 和 `DGRAINSIGHT_REPORT_SCRIPT_CN.md` 在本次开始时是本地未跟踪文件，不能告诉网页版直接去 GitHub 找它们。前者还是 2026-09-01 的旧主线简介。
- 本工程书是本次新建文件，尚未提交或推送。应直接上传或复制给网页版，不能假定它已在 GitHub 上。
- 是否已有最新页面部署、可用公开视频或定稿截图，本次没有验证。仓库地址不等于已确认可访问的演示网站地址。

## 11. 当前检查结果与可复现范围

本次整理时实际执行并通过：

```text
npm run test:performance
npm run test:web-graph-regression
```

第一项确认两模型新版数据记录数量、记录唯一性与覆盖、公式、缺失数据行为、等价删除范围以及网页有效窗口。第二项确认 DGraFormer、MSGNet、MTGNN 的既定网页图回归检查通过；这不表示 MTGNN 已新增 performance.v1 结果。

已有仓库文档还记录原始数组复算、Session 校验、浏览器检查和构建结果。**本次没有重新运行完整 Python 套件、全部浏览器测试、模型前向或生产构建。** 论文写“本次验证通过”的范围应限定到以上两项；其他验证可表述为仓库保存的已有记录。

## 12. 给论文写作的贡献组织建议

### 12.1 建议的三个系统贡献

**贡献一：保持模型原生语义的图关系探索。** 在统一交互框架下，区分 DGraFormer 的变量窗口图与 MSGNet 的潜在尺度图，明确有向边与原生矩阵位置的对应，避免用错误节点和方向解释干预。

**贡献二：围绕同一关系比较删除范围和预测误差。** 把模型、样本、上下文、source、target 与 scope 固定为可追踪身份，同时呈现单上下文与全部相关上下文的 MAE/MSE，以及按预测步和测试样本展开的误差变化。

**贡献三：基于版本化真实结果的可核对展示。** 用独立 performance.v1、原始数组、哈希和复算报告组织证据，显式处理微小变化、缺失值和历史复验边界。

这些是当前实现支持的系统贡献候选。相对于已有研究是否构成学术新颖性，仍需网页版检索并核对真实相关工作，不能仅凭工程新增就写成“首个”。

### 12.2 一段可用的英文项目定义

> DGraInsight is an interactive system for examining forecast-error changes under directed edge removal in learned-graph multivariate forecasting models. It preserves model-specific graph semantics, links an effective relation to its stored intervention results, and compares single-context and all-relevant-context removals through MAE, MSE, and error-change profiles across forecast steps and test samples. The current built-in demonstration covers DGraFormer and MSGNet on ETTh1 using versioned checkpoint-derived artifacts.

### 12.3 推荐论文结构与演示故事

论文可以按“问题与动机—系统设计—交互演示—实现与解释边界”组织。若用于 AAAI Demonstration，具体页数、日期和投稿要求应另外查阅当年的官方说明；本工程书不复制旧简介中的时效性会议信息。

演示可采用本工程书第 7 节的真实案例：先展示 DGraFormer 的窗口图，选择 HUFL→LUFL，比对单窗口和全部相关窗口，再切到逐预测步误差和跨测试样本误差；随后用 MSGNet 展示 G0→G1，解释潜在图节点与真实输出变量的区别，以及尺度删除的含义。

概览图建议突出如下关系：

```text
已验证的模型结果与图素材
            ↓
模型 / 测试样本 / 原生上下文
            ↓
选择有效有向关系 source → target
            ↓
单上下文删除  ↔  全部相关上下文删除
            ↓
MAE / MSE + 改善百分比
            ↓
预测步变化  ↔  跨测试样本变化
```

截图与科学图表必须来自真实页面或实际结果数据。图注应包含模型、样本索引、关系、窗口/尺度、删除范围、聚合维度及正负号约定。

## 13. 写论文时必须保留的事实边界

| 可以写 | 不应写 |
|---|---|
| 当前 checkpoint 和指定样本下的删边预测误差变化 | 发现真实世界变量间因果关系 |
| 当前新版覆盖 DGraFormer/MSGNet 的 ETTh1 性能结果 | 所有适配模型和所有保存数据集均已完成新版性能评测 |
| 浏览器交互查看与聚合保存的真实结果 | 浏览器点击即实时执行原模型推理 |
| 0.1% 相对阈值下的描述性改善/变差 | 该阈值证明统计显著或模型整体泛化收益 |
| 比较不同样本和预测步的误差变化分布 | 已证明跨样本统计稳定性或独立重复实验显著性 |
| 当前 performance.v1 与原始数组可相互复算 | MSGNet 历史预测已跨设备严格复现 |
| MSGNet 内部图位置 G0–G6 | G0 就是 HUFL、G1 就是 HULL |
| 仓库保留旧统计审计材料 | 当前 Summary 继续计算或展示旧 BH q 值与 Supported |
| 仓库提供代码与结果材料，外部资产需要另行获得 | 仓库已经包含全部数据、权重与完整上游源码 |

另一个容易出错的来源是 `docs/CURRENT_WEB_DATA_PROVENANCE.md`：它保留了较早 Phase 0 阶段的“前向待验证”叙述及旧导出图处理说明，应作为历史来源链阅读，不能覆盖新版语义核验和 performance.v1 的实现状态。

旧简介中的 Supported 比例、D、p/q 和匹配对照案例也不应自动带入这次新版性能论文。若作者未来决定重新纳入这些内容，应另行确认范围与所使用的协议版本。

## 14. 可直接复制给 ChatGPT 网页版的指令

```text
请把附件《DGraInsight 更新后项目工程书》作为当前项目事实边界，结合在线仓库 https://github.com/Chenjy-111/DGraInsight 帮助我写论文。

本工程书基于提交 58c7d04e00e5ff579430ebff0d757cb5e68264b1。先确认你能读取的线上版本；若 main 已变化，列出与该快照的差别，不要混用版本。

当前项目主线是：交互式探索学习图，选择有效有向边，比较单上下文与全部相关上下文删除后的真实 MAE/MSE，并查看按预测步和跨测试样本的误差变化。内置新版 performance.v1 覆盖 DGraFormer 和 MSGNet 在 ETTh1 上的结果。不要直接沿用旧版以 Supported、D 和 p/q 为主的项目简介。

请优先阅读 docs/PERFORMANCE_V1.md、src/components/evidence/PerformanceSummary.tsx、src/data/performance.ts、docs/SCIENTIFIC_SEMANTICS_REPAIR.md、src/App.tsx 和 src/components/SessionV2Evidence.tsx，再检查 public/data/performance/v1、artifacts/performance/v1 与相关测试。工程书附有更完整的 GitHub 导航。

有些页面介绍和旧文档仍保留历史叙事。遇到冲突，优先采用该快照实际调用的代码、结果数据和最新核验报告；例如当前误差图是默认按预测步的不平滑折线，而不是旧文档早段的默认跨样本柱图。

特别保留这些区别：DGraFormer 是变量窗口图；MSGNet 的 G0–G6 是内部潜在图位置，source→target 对应原生 A[target,source]，scale 不是连续时间窗口。Summary 聚合 96 步×7 输出；预测视图里的单变量选择不会把 Summary 改成单变量结果。0.1% 是描述性显示阈值，不是显著性检验。MSGNet 历史复验 FAIL 没有被新版配对 CPU 结果改成 PASS。

offline 部分暂时不写，只记住我后续计划增加一个 offline 模块，具体设计还要讨论；不要替我补充它的架构、工作流、实验或贡献。

请先输出：1）你对当前项目的准确理解；2）论文贡献—代码/数据证据对照表；3）适合当前系统的论文提纲；再开始正文写作。不要杜撰引用、模型效果、用户实验、运行速度、统计显著性或已上线状态。对还缺的作者信息、投稿规则、文献、截图和实验，用 [待作者确认] 明确标记。读取不到大型文件时，告诉我具体文件，不根据旧材料猜测新版内容。
```

---

本工程书只新增说明文件，未更改项目代码、原始预测数组、现有统计结果或旧项目简介，也未提交、推送或部署。
