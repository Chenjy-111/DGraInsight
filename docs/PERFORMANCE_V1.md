# 性能 Summary 改版验收（performance.v1）

## 保留的交互

先选择模型、样本、当前有效关系，再显示结果。DGraFormer 图与关系按钮共用 selectedEdge，窗口按钮与图共用 windowIdx；MSGNet 共用工作流关系身份。切换样本/上下文时保留仍有效的边，失效时清空并提示，不替换为其他边。异步样本响应检查请求身份，旧响应不能覆盖新样本。

图布局、样本切换、Window 按钮、选中高亮和删除范围切换继续可用。Window 对用户从 1 开始，结果同时标明模型从 0 开始的原生索引；MSGNet 始终使用 scale_index，未将尺度解释成时间窗口。

## 新数据

- 公共目录：public/data/performance/v1/{dgraformer,msgnet}.json，版本 performance.v1；Promise 缓存每模型一次加载，不按边请求。
- DGraFormer：原冻结 40 个样本 + 4 个已有网页额外样本；44 份基线、3,073 份删边，有效关系并集为 31。选项从当前样本实际进入模型的图读取，不写死数量。
- MSGNet：原冻结 14 个样本 + 4 个已有网页额外样本；18 份基线、3,024 份删边。
- 所有运行来自相同 checkpoint / CSV，Python 3.12.14、PyTorch 2.14.0+cpu、CPU、2 threads。固定原模型参数，不训练、不改变模型源码。
- 新运行的每个样本空干预与原始前向预测精确一致。旧 MSGNet 历史预测 CPU/CUDA 复验 FAIL 保留，不因新版计算而改为 PASS。
- 当前数据是独立新运行，使用通用 0.1% 相对阈值；旧冻结 MSGNet 专用绝对下限 0.00002 不推广到该新版本。
- 新结果不读取旧审计数据；旧导入仍可追溯图，结果区明确不可用，禁止回退旧结果。

基线和删边完整原始数组保存在 artifacts/performance/v1/*_raw.npz。JSON 的 rawArchive 包含其 SHA-256 和数组顺序；其中 prediction 与 records 同序，baseline/truth 与 samples 同序。原冻结文件未覆盖。

## 展示语义

唯一 Summary：当前关系/结论、当前样本真实 MAE/MSE 和改善百分比、六列单范围/全范围比较表、误差变化柱图、默认折叠的方法说明。先对原始误差求均值，再独立分类；零基线百分比不可用，缺失不补零。

首屏结论对应标出的当前图样本、删除范围、全部 96 个预测步及 7 个输出变量（1 个评估时间样本）。误差图默认沿用原冻结 40/14 个时间样本编号，每柱是该样本全部预测步/输出的平均误差差值；深色边框标记当前图样本。点击柱显示该时间样本前后误差、变化量及百分比，无页面跳转。可切换到当前图样本的原始 96 个预测步。没有构造额外时间段，缺失的上下文/边保留空缺。

误差图：后−前，正值红色变差、负值绿色改善；改善百分比：(前−后)/前，正值改善。阈值只分类，不改柱高。

## 复算与检查

离线生成（每个模型必须独立进程，避免上游同名包混用）：

```powershell
python scripts/export_performance_v1.py --model dgraformer --source-root <DGraFormer源码> --checkpoint <checkpoint.pth> --data-path <ETTh1.csv>
python scripts/export_performance_v1.py --model msgnet --source-root <MSGNet源码> --checkpoint <checkpoint.pth> --data-path <ETTh1.csv>
python scripts/verify_performance_v1.py
npm run test:performance
npm run test:web-graph-regression
npm run test:web-session-v2
npm run build
```

需要安装与记录一致的 Python 依赖。自定义适配器测试允许用 DGRAINSIGHT_PYTHON 和 DGRAINSIGHT_PYTHON_PATHS 指定已有解释器/依赖，默认行为不变。

生产预览启动后，设置 PERFORMANCE_URL 为本地预览地址，PLAYWRIGHT_MODULE 指向已安装的 Playwright，执行 npm run test:performance-browser（本机 Edge）。测试覆盖图点击、按钮选择、窗口失效、样本/尺度/范围同步、折叠、每模型单次请求、无旧审计请求和拒绝错误版本。

完整复算报告：artifacts/performance/v1/verification.json。598,464 个 DGraFormer 误差值和 584,064 个 MSGNet 误差值与原始数组重算精确相等。原图回归和导入校验通过。生产构建保留原有的大 JS bundle 警告；没有为此重构加载架构。

## Display update

The page is now English throughout. Error charts use unsmoothed lines with a zero reference and explicit gaps. The default view, **By forecast step**, averages output variables at each forecast step of the selected sample. **Across test samples** averages all forecast steps and outputs within each predeclared sample. The horizontal axis uses numeric step/sample indices; missing removals are never connected or imputed. MAE/MSE remain separate.

After selecting an edge, Summary window buttons, the graph window selector, the 3D window buttons and playback offer only its effective contexts. The underlying graphs, checkpoint parameters and offline numerical data are unchanged.
