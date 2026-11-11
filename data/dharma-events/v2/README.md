# 善念法讯 v2

`catalog.json` 是 App 唯一的线上法讯目录。v1 不再同步，也不作兼容转换。

## 发布规则

- 时间统一使用带 `+08:00` 的 ISO 8601，时区为 `Asia/Singapore`。
- 一场法会可有多段 `schedule`；客户端按每段日程生成月历标记。
- 官方只公布日期、未公布具体时间时，使用 `allDay: true`，不得猜测开始时间；`end` 按全天日历的惯例为不包含的结束日。
- `published` 必须有官方 HTTPS `sourceURL` 和 `verifiedAt`。
- 海报原图与缩略图一起放在 `media/<year>/`；列表只加载缩略图。
- AI/OCR 提取结果只是草稿。日期、地点、报名二维码和官方来源须人工确认后才能设为 `published`。
- `logoURL` 只能使用寺院官网或官方媒体提供的标识；缺失时 App 使用统一寺院图标。

## 官方来源巡检

`sources.json` 维护可信寺院官方页面。GitHub Actions 每日巡检一次，并生成候选报告：

```bash
python tools/crawl_official_sources.py --output crawl-report.json
```

巡检结果不会自动覆盖 `catalog.json`。对时间、地点、活动状态和报名链接完成人工核验后，才进入发布目录。

## 海报导入

macOS 上可先生成 OCR/QR 证据：

```bash
swift tools/extract_event_poster.swift poster.png > poster-evidence.json
```

脚本不会自动发布，它只输出识别文本、坐标、置信度和二维码内容，供后续结构化与人工校对。

