

# DGraInsight 汇报讲稿

> 建议时长：12～15 分钟，其中系统介绍 7～8 分钟、网页演示 4～5 分钟、总结 1 分钟。以下“讲稿”部分可以直接照读；“操作”部分是现场点击提示，不需要读出来。

## 一、汇报前准备

在项目根目录打开 PowerShell，依次执行：

```powershell
npm run build
npm run dev
```

浏览器打开 Vite 输出的本地地址，通常是 `http://localhost:5173`。

提前准备好以下三个 JSON 文件：

- `public/data/evidence/dgraformer_etth1_session_v2.json`：DGraFormer 的 Formal Evidence Audit。
- `public/data/evidence/msgnet_etth1_session_v2.json`：MSGNet 的 Formal Evidence Audit。
- `tests/fixtures/mtgnn_quick_session_v2.json`：MTGNN 的 Quick Inspection，适合演示单案例 audit。

建议现场先演示内置的 DGraFormer 正式证据，再导入 MTGNN Quick Session。这样既能展示正式统计结论，也能讲清普通用户怎样使用 audit。

---

## 二、完整讲稿

### 1. 开场：项目是什么（约 40 秒）

【操作】停留在首页标题区域。

【讲稿】

大家好，我今天汇报的项目是 **DGraInsight**。它面向多变量时间序列预测中的图模型，核心任务不是单纯把模型学习到的图画出来，而是进一步审计一个具体问题：**模型学习到的某条变量关系，是否真的对当前 checkpoint 的预测产生了可验证的功能影响？**

因此，DGraInsight 的定位是一个离线证据审计系统。它把图关系的发现、精确干预、对照比较、统计检验和结果展示连接成一条完整流程，最后生成一个带有模型、数据、checkpoint、配置和统计来源的可追溯证据记录。

这里要先强调一句：本系统审计的是**模型行为和模型依赖性**，不是现实世界变量之间的因果关系。

### 2. 研究背景与项目目的（约 1 分 30 秒）

【操作】向下滚动到 “The problem” 和 “What DGraInsight adds”。

【讲稿】

这个项目要解决的背景问题是：图预测模型通常会输出邻接矩阵、注意力权重或者动态关系图。我们可以看到某条边很粗、权重很高，但“图上看起来重要”并不等于“模型预测真正依赖它”。

传统流程往往停在“学习图—画图—观察强边”这一步。这里至少存在三个缺口。

第一，边权是模型内部结构量，不是功能证据。第二，仅仅删除一条边后看到预测变化，也不能说明这条边比其他边更特殊。第三，如果我们看了很多边以后只挑结果最好的边汇报，就会产生选择偏差和多重检验问题。

所以 DGraInsight 的目的可以概括为三点：

第一，提供**结构发现**能力，在不同模型原生的图上下文中查看关系。DGraFormer 对应 window，也就是窗口级图；MSGNet 对应 scale，也就是尺度级图；MTGNN 对应一个全局学习图。

第二，实现**精确干预迁移**。用户在图上选中的样本、上下文、源节点和目标节点，会原样进入离线干预，避免展示的是一条边、真正测试的却是另一条边。

第三，形成**受边界约束的证据**。系统会把目标边删除后的预测变化与匹配对照进行比较；正式审计还会在预先声明的样本和假设族上完成统计推断及多重检验校正。

### 3. 系统整体流程（约 1 分钟）

【操作】滚动到 “System at a glance”。

【讲稿】

系统流程分为六步：Input、Discover、Select、Test、Validate 和 Output。

输入包括训练好的 checkpoint、测试样本和模型学到的图。Discover 阶段查看预测和模型原生图结构；Select 阶段固定一条候选关系；Test 阶段通过模型适配器删除这条精确关系，并使用同一个 checkpoint 重新前向计算；Validate 阶段把目标干预与所有符合条件且不重复的对照边干预进行比较；最后输出 Portable Audit Session v2，也就是一个可携带、可校验的 JSON 证据包。

这里采用前后端分离的证据架构：Python 离线层负责真正加载模型、提取图、执行干预和统计分析；浏览器只负责验证并展示已经生成的 Session v2，不会在浏览器里重新跑神经网络，也不会重新计算 p 值或者补造缺失结果。

### 4. 为什么需要 Adapter（约 1 分钟）

【操作】滚动到 “Technical architecture”。

【讲稿】

不同模型的图语义并不一样，所以系统使用 Adapter，也就是模型适配器，把模型特有逻辑和共同审计逻辑分开。

目前维护了三个官方参考适配器。DGraFormer 提供窗口级图，MSGNet 提供尺度级图，MTGNN 提供全局学习图。适配器负责模型加载、基线前向、原生图提取以及精确的结构干预；共同审计核心负责候选关系、对照协议、证据记录、统计推断和 Session v2 输出。

这种设计的好处是：接入新模型时不需要重写网页和整套统计管线，只需要实现明确的 Adapter Contract。不过，通过适配器验证只代表这个模型具备 Quick Inspection 的技术条件，并不会自动获得 Formal Evidence Audit 资格。正式审计还需要另外冻结样本、候选假设族、依赖性处理和推断方法。

### 5. 网页基本使用方式（约 2 分钟）

【操作】回到页面上方 “Built-in Demo or Portable Audit Session”。先保持 Built-in Demo。

【讲稿】

网页有两种数据来源。

第一种是 Built-in Demo，也就是项目内置的、已经校验过的 DGraFormer 和 MSGNet 正式证据。第二种是 Portable Audit Session，用户可以导入离线管线生成的 Session v2 JSON。

使用内置 Demo 时，在 Workspace 01，也就是 Pattern Discovery 中选择模型、测试样本和原生图上下文。DGraFormer 可以切换 window，MSGNet 可以切换 scale。图中的有向边表示模型学习到的关系，点击一条边后，系统会固定 source、target、sample 和 context。

随后进入证据区域。对于正式审计，页面会显示局部范围和更广范围的对比。例如 DGraFormer 会比较单个 window 与所有保留 window；MSGNet 会比较单个 scale 与所有 scale。页面还会显示 BH 校正后的 q 值、Mean D、正值比例、实际有效样本数、主推断方法、敏感性分析以及 provenance。

如果导入的是 Quick Inspection，页面会显示 Workspace 02，也就是 Intervention Validation。这里可以看到基线预测与删边预测、目标干预响应、对照均值、D 值、对照分布以及模型和数据哈希。

### 6. Audit 的核心概念（约 2 分钟）

【操作】可停留在任意 Evidence Summary 或 Quick Inspection 指标卡片。

【讲稿】

接下来解释 audit 中最重要的指标。

系统首先保存基线预测，记为 baseline。然后删除选中的有向边，再用同一个 checkpoint 重新预测。目标边删除前后预测张量的平均绝对变化称为 focal response，也就是目标干预响应。当前预先声明的指标叫 `prediction_delta_abs`。

但目标响应本身没有参照，所以系统还会删除其他所有符合条件的、不重复的有向非自环边，得到一组 control responses。然后计算：

**D 等于 focal response 减去 control mean。**

如果 D 大于零，表示删除目标边带来的预测变化高于平均对照边；如果 D 小于零，表示它的变化低于平均对照。这里必须注意：单个案例中的正 D 只是描述性证据，不等于统计显著，也不等于真实因果关系。

Formal Evidence Audit 会把同一个候选关系放到预先声明的多个样本或测试单元上，得到一组 D，然后检验备择假设 `mean D > 0`。因为同一个假设族中会同时审计多条边，所以系统使用 Benjamini–Hochberg，也就是 BH 方法校正多重检验。页面中的 Supported 表示校正后的 q 值小于预先声明的 alpha，这里 alpha 是 0.05。

四种状态要严格区分：Supported 表示 BH 校正后获得支持；Not supported 表示已经正式审计，但没有建立一致证据；Not audited 表示这个精确关系或范围没有进入冻结的候选族；Unavailable 表示存在候选记录，但正式推断条件不足。Not supported 不能被表述为“证明这条边完全没用”。

### 7. Quick Inspection 的使用方法（约 2 分钟）

【讲稿】

Quick Inspection 是面向真实本地模型的单案例检查流程，适合探索和诊断。它会真正加载用户的模型源码、checkpoint 和数据集，发现模型原生图，选择一条保留边，执行目标删边和全部唯一合格对照删边，最后输出 Session v2。

它的标准使用顺序是：准备 Config v2，执行输入和适配器校验，查看真实候选边，运行向导生成 JSON，校验 JSON，最后导入网页。

在正式运行前，系统执行 V01 到 V09：V01 检查配置和适配器；V02 检查输入文件与哈希；V03 检查数据集兼容性；V04 检查样本构造；V05 检查 checkpoint 加载；V06 检查基线前向；V07 检查原生图提取；V08 用 identity intervention 验证不改变图时输出应与基线一致；V09 检查精确干预钩子确实可用。

只有这些检查全部通过，才能把结果称为真实 checkpoint-backed Quick Inspection。但它仍然只有一个案例，所以 Session 中的 formal inference 状态固定为 not evaluated，raw p 和 BH q 都是空值。

### 8. Formal Evidence Audit 的使用方法（约 1 分 30 秒）

【讲稿】

Formal Evidence Audit 面向可复现的正式证据。它不会在运行时重新挑样本或挑边，而是读取已经冻结的样本协议、候选假设族、控制协议、依赖性协议、主推断方法、敏感性分析和多重检验方案。

除了模型侧 V01 到 V09，它还要求 V10 统计协议验证和 V11 假设族验证通过。

DGraFormer 的测试窗口来自同一条连续时间序列，并且彼此重叠，因此主分析使用考虑依赖性的 moving-block bootstrap。MSGNet 的冻结审计使用单侧完整 exact sign-flip。两者最后都在各自冻结的假设族内部做 BH 校正。

当前冻结结果是：DGraFormer 在 8 个单窗口候选中有 1 个得到支持，在 4 个全保留窗口候选中有 1 个得到支持；MSGNet 在 126 个单尺度候选中有 27 个得到支持，在 42 个全尺度候选中有 14 个得到支持。

这些数量并不是“模型总共有多少条正确因果边”，而是“在当前 checkpoint、数据集、冻结样本、干预定义和统计协议下，有多少候选关系获得了功能证据支持”。

### 9. Session v2 与可复现性（约 1 分钟）

【讲稿】

两种 audit 最终都输出 Portable Audit Session v2。这个 JSON 保存模型、数据集和 checkpoint 身份，冻结的审计计划，样本和原生图张量，目标与对照干预结果，候选关系、假设族、跨样本统计、依赖性分析、验证报告、哈希、provenance 和限制说明。

Session v2 的价值在于把“运行模型”和“展示证据”解耦。别人拿到 JSON 后可以验证结构和语义，再在网页中复查证据，而不必拥有原始训练环境。对于损坏文件、重复对照、非法引用、错误张量形状、伪造的案例级 p 值或 p/q 不一致，导入器会整体拒绝，不会部分加载。

### 10. 局限性与结论（约 1 分钟）

【操作】滚动到 “Limitations”。

【讲稿】

最后总结这个系统的边界。

每一条结论都只针对明确命名的模型 checkpoint、数据集、样本、图上下文、候选关系和干预范围。一个 checkpoint 上的结果不能自动推广到其他 checkpoint；没有被审计的边不能根据图权重推断结果；Quick Inspection 不能冒充跨样本统计证据；Supported 也不能被解释为现实变量之间的因果关系。

DGraInsight 的核心贡献不是给每条边贴一个“真”或“假”的标签，而是把“看见模型内部结构”推进到“在明确协议下检验模型是否依赖该结构”，并且让这个过程可追溯、可复查、可复现。

我的汇报到这里，谢谢大家。

---

## 三、现场演示脚本

### 演示 A：Formal Evidence Audit（推荐，约 3 分钟）

1. 在首页点击 **Start guided example** 或进入 DGraFormer 的 Pattern Discovery。
2. 说明页面当前使用内置的 DGraFormer / ETTh1 Session v2，数据已经离线生成并通过校验。
3. 在证据区选择 **HUFL → LUFL**，再选择 **W6**。
4. 指出单窗口候选 `W6 · HUFL → LUFL` 为 Supported：
   - BH-adjusted q 约为 `0.00880`；
   - Mean D 约为 `+0.000962`；
   - Active / planned 为 `28 / 40`。
5. 强调“Supported”是 q 小于 0.05，并且是在冻结假设族内经过 BH 校正之后的结论。
6. 再选择 **HUFL → MUFL**，比较单窗口与 All Retained Windows。全窗口候选获得支持：
   - BH-adjusted q 约为 `0.000400`；
   - Mean D 约为 `+0.001246`；
   - Active / planned 为 `28 / 40`。
7. 用这两个例子说明：**同一条变量关系在局部 window 和全 window 范围下是两个不同的审计假设，支持状态可能不同。**

如果现场选择关系不顺利，可以直接在导入区选择：

```text
public/data/evidence/dgraformer_etth1_session_v2.json
```

导入成功后，页面顶部会显示 Session v2、模型、数据集、Adapter 和 checkpoint 哈希。

### 演示 B：Quick Inspection（约 2 分钟）

1. 在 **Import Audit Session** 中选择：

```text
tests/fixtures/mtgnn_quick_session_v2.json
```

2. 指出导入的是 MTGNN / Exchange-Rate，全局学习图中锁定的关系是 `0 → 6`。
3. 滚动到 Workspace 02：Intervention Validation。
4. 解释这个真实单案例记录：
   - Focal response 为 `0.0001971803`；
   - 对照边数量为 `27`；
   - Control mean 为 `0.0002866629`；
   - D 为 `-0.0000894826`。
5. 现场表述建议：

   “这个案例中，删除目标边引起的预测变化反而小于平均对照删边，因此没有表现出异常强的单案例影响。更重要的是，这是 Quick Inspection，所以我们只给出描述性结论，不计算案例级 p 值和 q 值。”

6. 展开 Interpretation boundary，说明网页明确区分“能够说明什么”和“不能说明什么”。

---

## 四、Audit 命令行使用说明

### 1. 安装环境

要求 Python 3.9、Node.js 20 或更高版本，以及 npm。

```powershell
python -m pip install -r requirements.txt
npm ci
```

### 2. Quick Inspection：推荐向导方式

先从对应模板开始：

- `configs/local_audit_dgraformer_etth1.json`
- `configs/local_audit_msgnet_etth1.json`
- `configs/local_audit_mtgnn_exchange.json`

配置中最重要的是：

- `source_root`：上游模型源码目录；
- `checkpoint.path`：训练好 checkpoint 的路径；
- `dataset.path`：数据集路径；
- 数据集变量顺序、输入长度和预测长度；
- `audit_mode: "quick_inspection"`；
- 模型所需的 `adapter_config`。

以 MTGNN 为例：

```powershell
python -m dgraudit validate `
  --config configs/local_audit_mtgnn_exchange.json

python -m dgraudit edges `
  --config configs/local_audit_mtgnn_exchange.json `
  --sample 0 `
  --limit 10

python -m dgraudit wizard `
  --config configs/local_audit_mtgnn_exchange.json `
  --output outputs/mtgnn_session_v2.json

python -m dgraudit validate-session `
  outputs/mtgnn_session_v2.json
```

其中：

- `validate` 负责在运行前阻断不兼容输入；
- `edges` 展示真实保留边和 source/target 编号；
- `wizard` 交互选择上下文和边，执行 audit，并保存一份带精确选择的时间戳配置；
- `validate-session` 对最终 JSON 做 Schema 和语义校验。

Windows 下也可以双击：

```text
Start-DGraInsight-Audit.cmd
```

它会让用户选择 DGraFormer、MSGNet 或 MTGNN，并可临时覆盖源码、checkpoint 和数据路径，然后启动同一个向导流程。

如果已经在 Config v2 中固定了关系，也可以跳过向导直接运行：

```powershell
python -m dgraudit audit `
  --config configs/local_audit_mtgnn_exchange.json `
  --output outputs/mtgnn_session_v2.json
```

### 3. Formal Evidence Audit：冻结协议复现

DGraFormer：

```powershell
python -m dgraudit validate `
  --config configs/formal_audit_v2_dgraformer_etth1_frozen40.json

python -m dgraudit audit `
  --config configs/formal_audit_v2_dgraformer_etth1_frozen40.json `
  --output outputs/dgraformer_formal_session_v2.json

python -m dgraudit validate-session `
  outputs/dgraformer_formal_session_v2.json
```

MSGNet：

```powershell
python -m dgraudit validate `
  --config configs/formal_audit_v2_msgnet_etth1_frozen14.json

python -m dgraudit audit `
  --config configs/formal_audit_v2_msgnet_etth1_frozen14.json `
  --output outputs/msgnet_formal_session_v2.json

python -m dgraudit validate-session `
  outputs/msgnet_formal_session_v2.json
```

Formal 配置不能在看到干预结果后随意改候选边、样本或假设族，否则会破坏冻结协议的含义。Custom Adapter 通过 V01～V09 后也不能直接运行 Formal 模式；必须另外声明并验证正式协议。

### 4. 导入网页

```powershell
npm run dev
```

打开本地网页，在 **Import Audit Session** 中选择生成的 JSON。网页会先完整验证 Session v2；通过后才切换当前数据源。关闭 Imported Session 后可回到 Built-in Demo。

---

## 五、答辩高频问题与建议回答

### Q1：图上权重最大的边是不是一定最重要？

不是。权重表示模型内部学习到的结构量，功能重要性要看精确删边后预测响应是否高于匹配对照，并且在正式审计中是否经过跨样本推断和多重检验校正。

### Q2：D 大于零是不是就说明这条边有效？

不能直接这样说。单案例 D 大于零只说明该案例中目标删边响应高于对照均值。只有在预先声明的多个审计单元上完成正式推断，并且 BH 校正后的 q 小于 alpha，才能在当前协议下标为 Supported。

### Q3：为什么一定要对照边？

因为任何删边都可能扰动模型。对照边提供了“普通删边会造成多大变化”的参照，使目标边的响应不再是孤立数字。

### Q4：为什么要做 BH 校正？

因为同时测试多条候选边时，即使所有边都没有稳定作用，也可能偶然出现较小 p 值。BH 在冻结假设族内部控制多重检验带来的错误发现风险。

### Q5：为什么 DGraFormer 和 MSGNet 使用不同推断方法？

DGraFormer 的冻结测试窗口来自同一连续时间序列且窗口重叠，D 值之间存在依赖，所以使用 moving-block bootstrap。MSGNet 当前冻结协议使用 14 个预先声明单元，并采用单侧完整 exact sign-flip。方法由正式协议预先指定，不根据结果临时选择。

### Q6：Supported 是不是因果关系？

不是。它只表示在指定 checkpoint、数据、候选关系、结构删边和统计协议下，模型预测对这条结构表现出一致的功能依赖证据。

### Q7：为什么网页不直接运行模型？

模型源码、依赖、checkpoint 和数据通常体积大且环境复杂。离线运行再导出 Session v2，可以把昂贵且敏感的计算与轻量展示解耦，同时让结果通过哈希、配置和验证报告被复查。

### Q8：能不能接入其他模型？

可以。新模型需要实现 Adapter Contract，并通过 V01～V09，之后可运行 Quick Inspection。若要获得 Formal Evidence Audit 支持，还需要单独冻结候选族、样本协议、依赖性协议和正式推断引擎。

### Q9：Not supported 是否说明边完全没用？

不是。它表示在当前被审计的 checkpoint、范围、样本和统计协议下，没有建立一致的功能证据。它不等于对所有样本、所有 checkpoint 或所有干预定义作出否定结论。

### Q10：如何保证 JSON 没有被随意修改？

Session v2 同时接受 JSON Schema、Python 语义校验和浏览器 TypeScript 校验。非法张量、引用错误、重复对照、案例级伪造 p/q、推断状态与数值矛盾等都会导致验证失败。模型、数据、checkpoint 和配置的哈希也保存在 provenance 中。

---

## 六、三分钟精简版讲稿

DGraInsight 是一个面向多变量图预测模型的离线证据审计系统。它解决的核心问题是：模型学习图中的一条强边，是否真的对当前 checkpoint 的预测有功能影响。

系统流程是 Discover、Select、Test、Validate。首先查看模型原生图，选择一个样本、图上下文和有向边；然后离线删除这条边，用同一 checkpoint 重新预测；再把目标删边响应与其他所有唯一合格对照边的删边响应进行比较；最后生成 Portable Audit Session v2，由网页校验和展示。

核心指标是 `D = focal response - control mean`。D 大于零表示目标边的删除比平均对照删除引起更大预测变化，但单案例 D 只是描述性证据。Formal Evidence Audit 会在预先声明的多个样本上检验 `mean D > 0`，并在冻结假设族内用 BH 校正。只有校正后的 q 小于 0.05，页面才标记 Supported。

系统支持两种模式。Quick Inspection 是真实 checkpoint 支持的单案例检查，通过 V01～V09 后生成 Session v2，但不计算案例级 p 和 q。Formal Evidence Audit 还冻结样本、候选族和统计方法，并要求 V10、V11 通过。当前正式结果为：DGraFormer 的单窗口候选支持 1/8、全窗口候选支持 1/4；MSGNet 的单尺度候选支持 27/126、全尺度候选支持 14/42。

系统目前提供 DGraFormer、MSGNet、MTGNN 三个官方参考适配器。网页不会重新运行模型或补算统计，只读取并验证 Session v2。因此结果可追溯、可复查，但结论只描述指定 checkpoint 在指定结构干预下的行为，不能解释为现实变量之间的因果关系。
