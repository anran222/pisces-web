# Pisces Web

`pisces-web` 是 Pisces 的管理台前端。

## 当前页面

- `/ai-center`：工作台
- `/ai-design`：新建实验
- `/experiments`：实验列表
- `/experiments/:id`：实验详情
- `/experiments/:id/decision`：实验分析
- `/variants-lab`：方案生成

## 当前定位

前端面向使用者，不展示系统自述型文案。当前主线是：

- 创建实验
- 定义实验组配置字段
- 为实验组填写具体配置值
- 查看实验详情和分析结果
- 生成文本 / 图片候选方案
- 生成示例实验或为已有实验补真实数据

## 启动

```bash
npm install
npm run dev
```

默认通过 Vite 代理 `/api` 到后端 `http://localhost:9990`。

## 当前接口对齐

### 实验

- `GET /api/experiments`
- `GET /api/experiments/{id}`
- `POST /api/experiments`
- `PUT /api/experiments/{id}`
- `POST /api/experiments/{id}/start`
- `POST /api/experiments/{id}/pause`
- `POST /api/experiments/{id}/resume`
- `POST /api/experiments/{id}/stop`
- `POST /api/experiments/{id}/conclusion-status`

### 分析

- `GET /api/analysis/experiment/{id}/statistics`
- `GET /api/analysis/experiment/{id}/ai-diagnosis`
- `GET /api/analysis/experiment/{id}/ai-graduation-decision`
- `POST /api/analysis/experiment/ai-design/v2`

### 变体

- `POST /api/variants/generate`

### 演示与补数

- `POST /api/experiments/generator/demo`
- `POST /api/experiments/generator/{id}/simulate`
