# Pisces Web - A/B测试平台前端

这是 Pisces A/B测试系统的前端管理界面，使用 React + Vite + TailwindCSS 构建。

## ✨ 功能特性

- 📊 **仪表盘** - 实验概览和关键指标展示
- 🧪 **实验管理** - 创建、启动、暂停、停止实验
- 📈 **数据分析** - 统计分析、贝叶斯分析、显著性检验
- 🤖 **AI变体生成** - 使用AI智能生成实验变体
- 🎯 **完整实验流程** - 一键完成从变体生成到实验分析

## 🚀 快速开始

### 1. 安装依赖

```bash
cd pisces-web
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

前端将在 http://localhost:3039 启动，并自动代理 `/api` 请求到后端 http://localhost:9990

### 3. 启动后端服务

确保后端服务在 9990 端口运行：

```bash
cd ../pisces
mvn spring-boot:run -pl pisces-service
```

## 🛠️ 技术栈

- **React 18** - 用户界面库
- **Vite 5** - 构建工具
- **TailwindCSS 3** - 样式框架
- **React Router 6** - 路由管理
- **Axios** - HTTP 客户端
- **Recharts** - 图表库
- **Lucide React** - 图标库

## 📁 项目结构

```
pisces-web/
├── public/              # 静态资源
├── src/
│   ├── components/      # 通用组件
│   │   └── Layout.jsx   # 布局组件
│   ├── pages/           # 页面组件
│   │   ├── Dashboard.jsx        # 仪表盘
│   │   ├── ExperimentList.jsx   # 实验列表
│   │   ├── ExperimentDetail.jsx # 实验详情
│   │   ├── CreateExperiment.jsx # 创建实验
│   │   ├── Analysis.jsx         # 数据分析
│   │   └── VariantGenerator.jsx # 变体生成
│   ├── services/        # API服务
│   │   └── api.js       # API封装
│   ├── App.jsx          # 应用入口
│   ├── main.jsx         # 渲染入口
│   └── index.css        # 全局样式
├── index.html           # HTML模板
├── package.json         # 依赖配置
├── vite.config.js       # Vite配置
├── tailwind.config.js   # Tailwind配置
└── postcss.config.js    # PostCSS配置
```

## 🎨 UI设计

- **深色主题** - 沉浸式深色界面，减少视觉疲劳
- **玻璃态效果** - 现代毛玻璃卡片设计
- **渐变配色** - 青色到紫色的品牌渐变
- **流畅动画** - 精心设计的过渡动效

## 📝 API 端点

前端通过 Vite 代理连接后端 API：

| 功能 | 端点 |
|------|------|
| 实验列表 | `GET /api/experiments` |
| 实验详情 | `GET /api/experiments/:id` |
| 创建实验 | `POST /api/experiments` |
| 启动实验 | `POST /api/experiments/:id/start` |
| 统计数据 | `GET /api/analysis/experiment/:id/statistics` |
| 贝叶斯分析 | `GET /api/analysis/experiment/:id/bayesian` |
| 变体生成 | `POST /api/variants/text/generate` |
| 完整流程 | `POST /api/variants/experiment/flow` |

## 🔧 配置

### 修改后端地址

编辑 `vite.config.js` 中的代理配置：

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:9990',  // 修改为实际后端地址
    changeOrigin: true,
  }
}
```

## 📦 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

构建产物将输出到 `dist` 目录，可部署到任意静态文件服务器。

## 🤝 与后端配合

1. 确保后端 CORS 配置允许前端域名
2. 生产环境建议使用 Nginx 反向代理统一管理
3. API 基础路径为 `/api`

---

**Pisces** - 让A/B测试更智能、更高效！
