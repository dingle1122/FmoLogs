FontCompression
===============

批量将 `fonts/` 目录中的 TTF 字体按字符集子集化，并输出为 WOFF2。

## 目录

- `main.py`: 主入口，完成字符集去重排序和字体子集化。
- `fonts/`: 原始 `.ttf` 字体文件。
- `resources/3500常用字.txt`: 默认字符集文件，运行时会自动去重、去空白并按 Unicode 排序。
- `dist/`: 生成的 `.woff2` 文件。
- `run_subset.sh`: 兼容入口，内部只调用 `main.py`。

## 使用

```bash
uv run python main.py
```

如果已经创建了 `.venv`，也可以直接运行：

```bash
.venv/bin/python main.py
```

兼容旧入口：

```bash
./run_subset.sh
```

## 参数

```bash
python main.py \
  --font-dir fonts \
  --charset resources/3500常用字.txt \
  --output-dir dist \
  --suffix -3500
```
