# Section 3：两个互补的真实结果观察

本次从已有 checkpoint-backed removal 结果中筛选案例，并从保存的原始 prediction / truth 数组重新计算所选案例的 MAE、MSE；没有新增模型重跑。两项观察均为描述性案例，不用于估计总体发生频率或统计显著性。

## 固定条件和度量

- 模型 / 数据：DGraFormer / ETTh1，test sample index 0，96 步、7 个输出。
- Checkpoint SHA-256：`f6abbd4e9b32ae80851f42d5476069c41c66b900b181f9f24c56d445a1cead9f`。
- 基线：MAE = 0.3520420699647903，MSE = 0.27209848608218057。
- 每次只删除指定 native window 中的一条有向关系，在归一化前进行结构删除，重新归一化并执行完整预测。
- MAE / MSE 在保存预测的输出尺度上，对全部 96 × 7 个误差取均值，不是仅对目标节点 LULL 计算。
- `Δ = after − baseline`；表中百分比为 `100 × Δ / baseline`。正号表示误差增加，负号表示误差减少。
- Window 1/2 是界面的从 1 开始编号，对应原生 context index 0/1。

## 观察一：Context dependence

同一条 HUFL → LUFL（0 → 4），同一 sample、checkpoint：

| 单窗口删除 | ΔMAE | MAE 相对变化 | ΔMSE | MSE 相对变化 |
|---|---:|---:|---:|---:|
| Window 1 | +0.000719741020 | +0.204447% | +0.000938724657 | +0.344994% |
| Window 2 | −0.000820823180 | −0.233161% | −0.001351155094 | −0.496568% |

两个指标的变化方向均随 native context 改变。

## 观察二：Weight–response mismatch

固定 sample 0、Window 2（native context index 1）、上述同一 checkpoint。两条关系均指向 LULL。

| Relation | 有效图权重 | 权重排名 | 删除后 MAE | MAE 相对变化 | 删除后 MSE | MSE 相对变化 |
|---|---:|---:|---:|---:|---:|---:|
| A：OT → LULL（6 → 5） | 0.499728 | 1 / 14 | 0.352135137861 | +0.026437% | 0.272369617305 | +0.099645% |
| B：HULL → LULL（1 → 5） | 0.240522 | 9 / 14 | 0.353060089524 | +0.289176% | 0.273885453156 | +0.656735% |

A 的有效图权重约为 B 的 2.08 倍，但 B 的 |ΔMAE| 约为 A 的 10.94 倍，|ΔMSE| 约为 A 的 6.59 倍。两者误差变化均为正，无需依赖正负方向的抵消来解释该对照。

**权重定义要写清楚：**主表取 `performance.v1.samples[].contexts[].edges[][2]`，即模型归一化后的有效图权重。排名覆盖该 native context 全部 14 条正权重非自环边，不使用界面阈值过滤。不要将此数值称为未归一化 raw learned score。

补充检查：网页保存的归一化前 `dynamic_graph` 权重分别为 0.9989141225814819 和 0.9177467226982117；在相同有效边集合中，排名也分别是第 1 和第 9。该阶段是包含静态先验混合并经非线性激活后的图，不等于纯 embedding 点积。论文推荐用 **normalized relation weight** 精确指代主表权重。

## 可直接用于论文的英文段落

For a fixed DGraFormer checkpoint and ETTh1 test sample 0, DGraInsight reveals two complementary observations. First, removing HUFL→LUFL increases MAE by 0.204% in native Window 1 but decreases it by 0.233% in Window 2, illustrating context-dependent error responses. Second, within Window 2, OT→LULL has the largest normalized relation weight (0.499728; rank 1 of 14), whereas HULL→LULL ranks ninth (0.240522). Yet removing the former increases MAE by only 0.0264%, compared with 0.2892% for the latter; the corresponding MSE increases are 0.0996% and 0.6567%. This descriptive counterexample shows that a larger normalized relation weight does not necessarily correspond to a larger forecasting-error response after relation removal. DGraInsight exposes this distinction through actual model re-execution under a specified intervention.

## 筛选与复核记录

运行 `python scripts/find_weight_response_case.py` 可重现本次筛选。

- 扫描同一结果文件的 1,892 条 single-context 记录；按 sample/context 严格分组后找到 3,429 个 MAE 大小逆序 pair（不代表独立样本或发生率）。
- 主案例的事后筛选规则：优先沿用 sample 0；A 排名第 1；A/B 同一目标；两条边的 MAE、MSE 变化均为正且 A 小于 B；在该子集中选择 MAE 差距最大的 pair。
- A/B 对应结果数组从 0 开始的 record index 22 / 13，scope 均为 `single`。
- NPZ 的 SHA-256 与结果文件声明完全一致；四条所选删除记录及基线均用原始数组重算，和存储误差的偏差小于 `1e-12`。
- A/B 的网页有效权重与 performance 文件完全相等。HUFL→LUFL 在 Window 1 的两份图导出存在约 `1.49e-8` 的浮点差异，记录在 evidence 中；该差异不涉及误差重算。
- 输出：`outputs/weight-response-case/evidence.json`（来源哈希、精确数值、复核结果）与 `all_mae_inversion_pairs.json`（完整候选列表）。
- 输入：`public/data/performance/v1/dgraformer.json`、`public/data/samples/ETTh1_000_h96.json`、`artifacts/performance/v1/dgraformer_raw.npz`。

本案例足以反驳“权重排序必然等于误差响应排序”，不支持“所有大权重边都不重要”或“两个量总体不相关”的更强结论。
