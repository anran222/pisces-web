# Pisces Web

`pisces-web` 是 Pisces 的管理台前端。

## 当前页面

- `/ai-center`：工作台
- `/ai-design`：新建实验
- `/experiments`：实验列表
- `/experiments/:id`：实验详情、配置草稿、配置版本和审计
- `/experiments/:id/decision`：实验分析
- `/applications`：应用空间、配置/启动审批待办与应用级事件/指标字典
- `/variants-lab`：方案生成

## 当前定位

前端面向使用者，不展示系统自述型文案。当前主线是：

- 创建实验
- 从应用字典导入事件和指标定义
- 定义实验组配置字段
- 为实验组填写具体配置值
- 查看实验详情和分析结果
- 编辑配置草稿，发布为运行时配置版本，并按历史版本回滚
- 集中处理配置/启动审批待办
- 生成文本 / 图片候选方案
- 生成示例实验或为已有实验补真实数据

## 启动

```bash
npm install
export VITE_PISCES_API_KEY="<management-or-analysis-key>"
npm run dev
```

默认通过 Vite 代理 `/api` 到后端 `http://localhost:9990`。
`VITE_PISCES_API_KEY` 会写入 `X-Pisces-Api-Key` 请求头，用于访问管理和分析接口。

## 核心功能截图

生产级完成审计使用横屏核心功能截图作为前端证据。先启动 dev server：

```bash
npm run dev -- --host 127.0.0.1 --port 3040
```

再在另一个终端生成截图：

```bash
npm run capture:core
```

默认输出到 `target/screenshots/core-functions-current`。可通过 `PISCES_WEB_BASE_URL` 和 `PISCES_WEB_SCREENSHOT_DIR` 覆盖访问地址和输出目录。

## 依赖审计

生产依赖 high 级风险检查：

```bash
npm run audit:prod-high
```

## 当前接口对齐

### 实验

- `GET /api/experiments`：支持 `status` / `statuses` / `appId` / `owner` 筛选
- `GET /api/experiments/{id}`
- `GET /api/experiments/{id}/audit-logs`
- `GET /api/experiments/{id}/config-versions`
- `GET /api/experiments/{id}/config-draft`
- `PUT /api/experiments/{id}/config-draft`
- `POST /api/experiments/{id}/config-draft/publish`
- `POST /api/experiments/{id}/config-versions/publish`
- `POST /api/experiments/{id}/config-versions/rollback`
- `POST /api/experiments`
- `PUT /api/experiments/{id}`
- `POST /api/experiments/{id}/start`
- `POST /api/experiments/{id}/pause`
- `POST /api/experiments/{id}/resume`
- `POST /api/experiments/{id}/stop`
- `POST /api/experiments/{id}/conclusion-status`

### 应用空间

- `GET /api/applications`：为实验列表的应用 ID 筛选提供可见应用候选项
- `GET /api/applications/{appId}/dictionary`：查看应用级事件/指标字典
- `PUT /api/applications/{appId}`：更新应用空间治理信息
- `GET /api/experiments/approval-tasks`：查看当前身份可见的配置/启动审批待办
- `POST /api/experiments/{id}/approval-status`：通过或拒绝配置/启动审批

### 分析

- `GET /api/analysis/experiment/{id}/statistics`
- `GET /api/analysis/experiment/{id}/event-pipeline`
- `POST /api/analysis/experiment/{id}/event-pipeline/dead/retry`
- `POST /api/analysis/experiment/{id}/events/replay`
- `POST /api/analysis/experiment/{id}/events/replay/plan`
- `GET /api/analysis/experiment/{id}/events/replay/jobs`
- `GET /api/analysis/experiment/{id}/ai-diagnosis`
- `GET /api/analysis/experiment/{id}/ai-graduation-decision`
- `POST /api/analysis/experiment/ai-design/v2`

### 变体

- `POST /api/variants/generate`

### 演示与补数

- `POST /api/experiments/generator/demo`
- `POST /api/experiments/generator/{id}/simulate`
