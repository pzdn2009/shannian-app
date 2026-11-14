# 善念禅观内容 v1

正文使用独立 UTF-8 `.txt` 文件；JSON 只维护目录、稳定 ID、顺序、来源与校验值。客户端的完成进度、圆满次数和计时记录始终只保存在设备本地。

## 更新正文

1. 修改 `items/<条目 ID>/` 下对应的 `.txt`。
2. 运行发布准备命令，它会递增内容版本和目录 revision，并重算正文、条目清单的 SHA-256：

   ```bash
   python3 data/contemplations/v1/tools/manage_content.py publish huayan.samanta-vows
   ```

3. 查看 Git diff，人工核对经典原文和引用。
4. 运行与 CI 相同的只读校验：

   ```bash
   python3 data/contemplations/v1/tools/manage_content.py check
   ```

新增条目时先建立条目目录、`item.json` 和各单元 `.txt`，再把条目登记到 `catalog.json`。稳定的条目 ID 与单元 ID 发布后不得改名或复用。

同时修改多个条目时，将所有 ID 放在同一条命令后，脚本会完成一次原子校验：

```bash
python3 data/contemplations/v1/tools/manage_content.py publish huayan.samanta-vows tiantai.six-gates
```

普通正文更新不需要发布新版 App。App 会在打开禅观栏目时拉取、完整校验并缓存新内容；远端异常时继续使用上一份已验证缓存或 App 内置快照。
