# NEU ACM CF

东北大学 ACM 队 Codeforces 训练统计。前端由 GitHub Pages 自动发布，后端运行在自有服务器并每 20 分钟刷新一次 SQLite 缓存。

## 项目结构

- `Frontend/`：Vue 3、TypeScript、Vite；生产 API 为 `https://124.223.4.216`。
- `Backend/`：Express、SQLite、Codeforces 抓取、定时任务、Docker 与 Nginx 配置。
- `.github/workflows/deploy.yml`：测试两个 workspace，只发布 `Frontend/dist`。

## 本地开发

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

前端开发地址为 `http://localhost:5173`，本地会直接请求 `http://localhost:3000`。

## 检查与构建

```bash
npm test
npm run typecheck
npm run build
```

## 后端部署

后端只映射到服务器回环地址，由宿主机 Nginx 提供公网 HTTPS：

```bash
docker compose -f Backend/compose.yaml up -d --build
docker compose -f Backend/compose.yaml logs -f api
```

SQLite 位于 Docker 命名卷 `backend-data`。重建容器不会删除该卷；删除卷前应先备份。

公网 IP 证书由 `/opt/certbot` 中的 Certbot 管理，`certbot-renew.timer` 每天检查四次并在续期成功后 reload Nginx。

## GitHub Pages

仓库设置中将 `Settings -> Pages -> Source` 设为 `GitHub Actions`。推送到 `main` 后工作流自动测试、构建并发布：

`https://stonexieac.github.io/NEU-ACM-CF/`

## 运行状态

- `GET /api/health/live`：进程存活。
- `GET /api/health/ready`：SQLite 已有可用缓存。
- `GET /api/stats?startDate=2026-03-01`：按北京时间当天 12:00 统计。

日志通过标准输出写入 Docker 日志；Nginx 使用系统默认 access/error 日志和 logrotate。
