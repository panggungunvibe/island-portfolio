# 数据与制作说明

## 文件职责

- `assets/template/`：完整可运行 Vite + Three.js 模板，场景不依赖在线模型/字体。
- `src/portfolio.json`：身份和模块数据，唯一的个人内容入口。
- `src/schema.js`：3/4 模块校验、固定地形槽位、HTML 转义和安全链接协议。
- `src/content.js`：从配置生成营地和全部主题。
- `src/exhibits.js`：按模块 kind 渲染可交互内容，动态图片查看器。
- `src/island.js`、`models.js`、`navigation.js`：模型、场景、移动；常规替换内容时无需改它们。
- `src/main.js`：动态网站名字、导航、地图、探索总数、主题。

## JSON 约定

新网站使用固定四部分，参照 [四模块示例](../examples/four-modules.json) 的字段结构。三部分数据只保留用于已有网站兼容，不在新用户流程中推荐。示例、原作者网站与 README 截图中的个人内容均不得复制到用户数据。

```json
{
  "version": 1,
  "profile": {
    "name": "用户称呼",
    "title": "用户确认的网站名",
    "subtitle": "可选短副标题",
    "intro": "依据真实材料撰写的介绍",
    "links": [{"label": "GitHub", "url": "https://github.com/用户名"}]
  },
  "modules": ["这里必须替换为四个模块对象，不能保留此说明"]
}
```

模块对象必填：
- `id`：唯一小写英文 slug，如 `campus`，不能与别的模块重复。
- `name`：分类名称，建议 4–8 个汉字。
- `short`：场景标签，建议不超过 6 个汉字。
- `kind`：`gallery` / `awards` / `research` / `projects`。
- `items`：真实条目数组。用户明确表示没有该类内容时可为 `[]`，同时必须设置 `emptyConfirmed: true`；未收集或未回答不能用空数组冒充已完成。空部分只显示“暂无展示内容”，不填虚构条目。

模块可选：`intro` 一句话、`description`、`english`、`metrics`、`links`、`timeline`。

条目必填：`title`、`summary`。研究/项目还必须提供非空 `chapters`，通常三章，但支持实际需要的章节数。

条目可选：
- `kicker`：时间、活动或刊物等短说明。
- `image`：**生成前**是本地图片路径（相对 JSON 文件或绝对路径）；脚本复制后改为 `/assets/module-N-item-M.ext`。支持 PNG/JPG/JPEG/WebP/AVIF/GIF。不从远程自动下载图片。
- `alt`：图片内容说明。
- `url`：真实原作/论文/项目链接，无链接时省略。
- `metrics`：`[{"value":"实际数值","label":"口径与时间"}]`，只放有依据的结果。
- `rank`、`result`：真实奖项或排名，不知道则省略；序号只是序号。
- `chapters`：`[{"title":"本章题目","text":"实际内容"}]`。
- `reflection`：已获用户确认的复盘或标明性质的解读。
- `sourceNote`：如“截图数据，非实时；团队获奖，个人负责交互设计”。

`timeline` 是 `[{"period":"时间段","title":"组织 / 角色","text":"职责与成果"}]`。

所有文字按纯文本处理；不要写 HTML、脚本或 Markdown 嵌入。链接只接受 http(s)/mailto；模板没有跟踪代码和自动点赞逻辑。

## 执行

```bash
python3 /实际安装路径/island-portfolio/scripts/scaffold.py --brief /路径/portfolio.json --output /路径/my-portfolio
cd /路径/my-portfolio
npm ci
npm test
npm run build
npm run dev -- --port 5173
```

目录有空格时给路径加引号。若已有服务占用 5173，选一个未使用的端口并交付实际地址，不能停掉用户的其他服务。静态产物在 `dist/`。

示例只供字段格式参考。材料收齐后，从当前用户的已确认资料新建 JSON，不从演示数据逐项改名。profile、每个 item、图片与链接都必须能对应到访谈材料；无个人称呼时 profile.name 使用已确认的网站名。简介可基于材料总结，不加入作者经历或未确认成果。

## 编辑与保留

新网站独立于 Skill；之后在生成项目的 `src/portfolio.json` 更新内容。新增图片复制到 `public/assets/` 并写 `/assets/文件名`。不要把生成网站直接嵌套在 Skill 的模板目录，以免更新 Skill 时覆盖用户作品。

默认三维角色是模板角色，并不等于用户真人。如果用户要求个性化形象，再依据其授权照片/描述修改；不要从身份选项推断外貌。

## 最小交互验收矩阵

| 范围 | 要检查的内容 |
|---|---|
| 三模块/四模块 | 场景物件、触发点、导航、地图、探索总数全部一致 |
| 每个模块 | 能抵达，能看全文，能切换所有条目和章节 |
| 图片/链接 | 加载成功，放大与关闭可用，链接非假地址 |
| 每种主题 | 森林/沙洲/浅海景观切换，面板同步，阅读状态不丢 |
| 桌面/手机 | 没有横向溢出；菜单、关闭按钮和长标题可用 |
| 行走 | 点击/WASD/方向控制、绕障碍、边界、全局视角 |
| 降级 | WebGL 无法使用时仍能由分类入口读内容 |

论文全文与外链可能需要登录，明确未验证部分。部署或推 GitHub 不是此 Skill 的默认步骤，需要当前用户明确要求。
