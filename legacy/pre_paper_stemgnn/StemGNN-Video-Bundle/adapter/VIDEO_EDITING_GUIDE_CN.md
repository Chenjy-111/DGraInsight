# StemGNN Thin Adapter 分块讲解与视频剪辑方案

完整可运行代码是同目录的 `stemgnn.py`。视频不需要逐字输入代码；建议先展示
`template.py` 的六个空方法，再通过剪辑依次展示下面九个完成后的模块。每一段均回答：
这一模块做什么、StemGNN 如何实现、其他用户需要替换什么。

## 片段 1：导入契约和模型依赖

展示新增代码：

```python
import csv
import hashlib
import importlib.util
import platform
from pathlib import Path
from typing import Any

import numpy as np
import torch

from dgraudit.thin_adapter import (
    AdapterCapabilities,
    GraphContext,
    Relation,
    Sample,
    ThinAdapter,
)

DEFAULT_ADAPTER_CLASS = "StemGNNAdapter"
```

建议讲解：

> Adapter 同时连接两侧：一侧是用户模型需要的 PyTorch、NumPy 和数据读取工具；
> 另一侧是 DGraInsight 提供的 ThinAdapter、Sample、GraphContext 和 Relation 数据契约。
> DEFAULT_ADAPTER_CLASS 让离线向导能够自动建议正确的类名。

用户适配自己的模型时：保留 `dgraudit.thin_adapter` 导入，将 PyTorch、数据读取库和
模型依赖替换成自己的环境。不要在模块导入阶段启动训练、下载数据或运行实验。

## 片段 2：声明能力和固定模型结构

展示新增代码：

```python
class StemGNNAdapter(ThinAdapter):
    capabilities = AdapterCapabilities(
        supports_single_context=True,
        supports_all_contexts=False,
        supports_batch=False,
        directed=False,
        node_semantics="observed",
    )

    node_count = 25
    window = 28
    horizon = 28
    stack_count = 2
    multi_layer = 1
    context_id = "latent-correlation"
```

建议讲解：

> 适配器首先声明真实能力。这个 StemGNN checkpoint 有 25 个观测节点、28 步输入和
> 28 步预测。它生成一个对称的 sample-dependent graph，因此 relation 被声明为无向；
> 当前 adapter 只提供单 context、单 sample 执行，不夸大未实现的能力。

用户适配自己的模型时，要替换节点数、输入窗口、预测长度和 checkpoint 架构参数，
并明确回答：图是否有向、节点是观测变量还是 latent position、是否有多个 layer/scale/window、
是否真的支持 batch 和跨 context 删除。

## 片段 3：解析并验证本地资源

展示 `load()` 的第一部分：

```python
self.source_root = resolve(config, config["source_root"])
self.dataset_path = resolve(config, config["dataset"]["path"])
self.checkpoint_path = resolve(config, config["checkpoint"]["path"])

dataset_hash = sha256(self.dataset_path)
checkpoint_hash = sha256(self.checkpoint_path)
if config["dataset"].get("sha256") not in (None, dataset_hash):
    raise ValueError("Dataset SHA-256 does not match the selected file")
if config["checkpoint"].get("sha256") not in (None, checkpoint_hash):
    raise ValueError("Checkpoint SHA-256 does not match the selected file")
```

建议讲解：

> Offline Evaluator 将用户选择的源码、数据和 checkpoint 路径传给 load。Adapter 解析
> 这些本地路径并核对向导记录的 SHA-256，避免运行过程中静默换成另一个资源。

用户适配自己的模型时，通常保留路径和哈希检查，只替换源代码布局，例如模型入口文件、
词表、scaler 或额外配置的位置。资源不存在或身份不一致时应该明确失败，不能自动找一个近似文件。

## 片段 4：构建模型并加载 checkpoint

展示 `load()` 的模型部分：

```python
spec = importlib.util.spec_from_file_location(
    "dgrainsight_external_stemgnn_model", compatible_model
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

self.model = module.Model(
    self.node_count,
    self.stack_count,
    self.window,
    self.multi_layer,
    horizon=self.horizon,
    device="cpu",
).cpu().eval()

checkpoint = torch.load(
    self.checkpoint_path, map_location="cpu", weights_only=True
)
self.model.load_state_dict(checkpoint["state_dict"], strict=True)
```

建议讲解：

> Adapter 使用 checkpoint 对应的架构参数实例化原模型，再以 strict 模式加载真实权重并
> 切换到 evaluation mode。当前 StemGNN 官方源码使用已经移除的旧 FFT API，因此包中保留
> 一份只替换 FFT 调用的兼容文件；谱图和预测主体没有在 adapter 中重写。

用户适配自己的模型时，将 `module.Model(...)` 和 checkpoint 解包方式替换成自己项目的
原始加载流程。关键是参数必须与 checkpoint 一致，并调用 `eval()`；不能用随机模型替代加载失败。

## 片段 5：恢复训练时的数据预处理

展示 `load()` 的数据部分：

```python
data = np.genfromtxt(
    self.dataset_path, delimiter=",", skip_header=1, dtype=np.float64
)

train_end = int(0.6 * len(data))
validation_end = int(0.8 * len(data))
self.train_mean = data[:train_end].mean(axis=0)
self.train_std = data[:train_end].std(axis=0)
self.train_std[self.train_std == 0] = 1
self.test_data = data[validation_end:]
self.sample_count = len(self.test_data) - self.window - self.horizon + 1
```

建议讲解：

> Adapter 必须恢复 checkpoint 训练时的数据顺序、split 和 normalization。这里使用时间顺序
> 的 60/20/20 split，并且 z-score 只由训练行计算。测试样本不会参与 scaler 拟合。

用户适配自己的模型时，应直接复用项目的数据模块；如果只能在 adapter 中调用预处理，必须
逐项保持 split、缺失值处理、时间特征、归一化轴和 inverse transform 一致。为了方便而改变
预处理会使 checkpoint forward 失去意义。

`load()` 的后半部分还返回 metadata，包括模型名、节点、输出、协议、度量空间和 provenance。
这些字段用于网页解释结果；它们必须描述真实语义，尤其是节点含义、边方向、归一化和删除范围。

## 片段 6：把 sample ID 映射到精确测试窗口

展示新增方法：

```python
def load_sample(self, sample_id):
    index = int(sample_id)
    if str(index) != str(sample_id) or not 0 <= index < self.sample_count:
        raise ValueError("Invalid exact sample ID")

    history = self.test_data[index:index + self.window]
    truth = self.test_data[
        index + self.window:index + self.window + self.horizon
    ].copy()
    normalized = (history - self.train_mean) / self.train_std
    model_input = torch.tensor(normalized[None], dtype=torch.float32)
    return Sample(str(sample_id), model_input, truth)
```

建议讲解：

> load_sample 将稳定的 sample ID 映射到一个精确测试窗口，并同时返回模型输入和对应 truth。
> 如果 ID 无效，adapter 会失败，而不是悄悄替换成另一个样本。

用户适配自己的模型时，可以把任意模型输入保存在 `Sample.input` 中，包括多个 tensor、时间编码、
节点属性或 decoder input。唯一共同要求是 `Sample.truth` 与最终预测使用相同的 `[steps, outputs]`
布局和度量尺度。

## 片段 7：调用原始 forward 并统一输出

展示两个方法的关键部分：

```python
def predict(self, sample):
    prediction, graph = self._native_forward(sample)
    self.last_graph = graph
    self.last_sample_id = sample.id
    return prediction

def _native_forward(self, sample):
    with torch.no_grad():
        forecast, graph = self.model(sample.input)
    prediction = (
        forecast[0].detach().cpu().double().numpy() * self.train_std
        + self.train_mean
    )
    return prediction, graph.detach().cpu().clone()
```

建议讲解：

> predict 调用原始 StemGNN forward，并将预测从训练 normalization 空间还原为每日病例尺度。
> Thin Adapter 只统一最终输出为 forecast-step × output，不规定模型内部输入或返回值格式。

用户适配自己的模型时，应从模型原始返回值中提取 forecast，并恢复到 truth 的尺度。这个方法必须
真正执行 forward，不能读取预先缓存的预测；模型返回 tuple 或 dictionary 都可以在这里转换。

## 片段 8：声明图 context 并暴露真实 relation

展示新增方法：

```python
def get_contexts(self, sample):
    return [GraphContext(
        "latent-correlation",
        "sample_dependent_undirected_graph",
        "Latent correlation graph shared by both StockBlocks",
        0,
    )]

def get_relations(self, sample, context):
    if self.last_graph is None or self.last_sample_id != sample.id:
        self.predict(sample)
    graph = self.last_graph
    return [
        Relation(str(source), str(target), float(graph[source, target]))
        for source in range(self.node_count)
        for target in range(source + 1, self.node_count)
        if float(graph[source, target]) != 0.0
    ]
```

建议讲解：

> Context 表示 relation 在模型中被消费的位置。StemGNN 的一个样本产生一张 latent-correlation
> graph，并由两个 StockBlock 共享。由于返回图对称，每个无向 pair 只暴露一次，weight 直接来自
> 本次原生 forward，而不是在 adapter 外重新计算的相关系数。

用户适配自己的模型时，应按真实层、尺度、窗口或 encoder/decoder 位置返回不同 context。
`get_relations` 必须明确矩阵方向和权重阶段：raw score、softmax attention、normalized support 或
binary adjacency 不能混称。如果原生 `A[target, source]` 表示消息方向，应在这里转换成统一的
source-to-target 标识。

## 片段 9：分派 identity 和 remove 请求

展示公开方法：

```python
def predict_with_intervention(self, sample, request):
    if request.context_ids != (self.context_id,):
        raise ValueError("StemGNN requires the exact context")
    if request.operation == "identity":
        return self._run_override(sample, None, None)
    if request.operation != "remove":
        raise ValueError("Unsupported intervention")

    source, target = int(request.source), int(request.target)
    if not (0 <= source < target < self.node_count):
        raise ValueError("Invalid undirected relation")
    return self._run_override(sample, source, target)
```

建议讲解：

> 公共 intervention 方法先验证 context、scope、operation 和节点 ID，再把请求交给模型专用的
> 原生执行路径。Identity 也通过同一个 override 机制重新 forward，只是不改变图。

用户适配自己的模型时，需要决定 relation removal 允许在哪些 context 中发生。无法支持的组合应
返回明确错误，不要把 all-context 请求静默降级成 single-context，也不要用缓存 baseline 冒充 identity。

## 片段 10：在原生位置删除 relation

展示 `_run_override()` 最重要的 hook：

```python
def attention_override(_module, _args, output):
    changed = output.clone()
    if source is not None:
        changed[:, source, target] = 0
        changed[:, target, source] = 0
    directed_after_override = changed.detach().clone()
    return changed

attention_hook = self.model.dropout.register_forward_hook(attention_override)
support_hooks = [
    block.register_forward_pre_hook(capture_support)
    for block in self.model.stock_block
]
try:
    prediction, graph = self._native_forward(sample)
finally:
    attention_hook.remove()
    for hook in support_hooks:
        hook.remove()
```

建议讲解：

> Adapter 在 self-graph attention 的原生 dropout 输出处修改关系。StemGNN 随后自己执行 batch mean、
> degree、symmetrization、Laplacian、Chebyshev support 和完整预测。因为模型使用对称图，一个无向
> relation 对应两个 attention entries。Hook 在 finally 中移除，因此每次请求都从原图重新开始。

用户适配自己的模型时，最重要的工作是找到“模型真正消费的 relation tensor”，而不是选择一个
方便展示但不会影响 forward 的矩阵。然后必须说明删除后是否需要重新 softmax、行归一化、自环处理、
高阶 support 重建，以及一条 relation 会影响多少层、时间步或分支。

## 片段 11：验证实际被消费的图状态

展示验证逻辑的核心：

```python
expected_support = self._expected_support(directed_after_override)
if not all(torch.equal(value, expected_support) for value in consumed_supports):
    raise ValueError("A StockBlock did not consume the expected native support")

if source is None:
    assert graph equals baseline_graph
    assert prediction equals baseline_prediction
else:
    assert graph[source, target] == 0
    assert graph[target, source] == 0
    assert all unselected graph entries are unchanged
```

实际文件使用显式 `ValueError`，而不是依赖可被禁用的 Python `assert`。

建议讲解：

> 预测发生变化并不能证明指定 relation 被正确删除。Adapter 同时检查两个目标 entry、所有未选
> graph entries，以及两个 StockBlock 实际接收的 Chebyshev support。只有这些检查通过，才返回
> graphStateVerification: passed。

用户适配自己的模型时，验证对象应尽量靠近真实消费点，例如 graph convolution 的 support、
message-passing operand 或 sampled binary adjacency。无法观察时应报告 unavailable，不能仅凭输出变化
声称原生干预已验证。

## 片段 12：关闭资源

展示最后一个可选方法：

```python
def close(self):
    self.last_graph = None
    self.last_sample_id = None
    self.model = None
```

建议讲解：

> close 是可选清理接口。临时 hook 已在每次 intervention 的 finally 中移除；这里释放模型和缓存引用。

用户适配自己的模型时，可在这里关闭文件、子进程、GPU worker 或其他长期资源。

## 收尾画面

把所有方法折叠，只显示：

```text
load
load_sample
predict
get_contexts
get_relations
predict_with_intervention
```

推荐收尾旁白：

> The evaluator core remains model-independent. To connect another model, its developer maps six pieces of native
> knowledge into the same contract: resources, samples, prediction, graph contexts, relation semantics and the
> native intervention point. DGraInsight then provides common validation, execution, metrics, incremental saving
> and visualization.

不要声称工具可以自动理解任意模型。准确说法是：任何模型开发者都可以实现这六个接口，但他必须
了解自己模型的真实预处理、图方向、归一化和 relation consumption point。
