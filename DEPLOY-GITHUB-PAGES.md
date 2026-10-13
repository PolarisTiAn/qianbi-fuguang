# 发布到 GitHub Pages

1. 在 GitHub 新建一个空仓库，例如 `qianbi-fuguang`，不要勾选 README、License 或 `.gitignore`。
2. 在本地项目目录执行：

   ```bash
   git remote add origin https://github.com/你的用户名/qianbi-fuguang.git
   git push -u origin main
   ```

3. 打开仓库的 **Actions**，等待 `Deploy to GitHub Pages` 完成。
4. 在 **Settings → Pages** 中确认发布来源为 **GitHub Actions**。
5. 页面地址通常是：

   `https://你的用户名.github.io/qianbi-fuguang/`

工作流只发布网页需要的文件和 `assets` 图片，不发布 `node_modules`、测试截图或本地测试脚本。
