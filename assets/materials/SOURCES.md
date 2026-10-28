# 洞窟表面材质来源

这些贴图用于土壁、甬道、台基与地面的视觉模拟，不是莫高窟第 61 窟的实测材质，也不构成考古测绘或历史复原依据。

原始纹理来自 Poly Haven，采用 CC0 许可：

| 材质 | 来源 | 本项目用途 |
| --- | --- | --- |
| Clay Plaster | https://polyhaven.com/a/clay_plaster | 土壁底色、表面法线与粗糙度 |
| Worn Cracked Plaster | https://polyhaven.com/a/worn_cracked_plaster | 少量混合，增加抹灰磨损层次 |
| Dirt Floor | https://polyhaven.com/a/dirt_floor | 洞内与甬道地面 |

许可说明：https://polyhaven.com/license

`scripts/prepare-cave-materials.py` 将上述贴图混合、调整色调、缩小并压缩为六张本地 WebP。`earth-*` 来自前两组材质，`floor-*` 来自 Dirt Floor。`color` 为颜色贴图，`normal` 为法线贴图，`orm` 的 RGB 通道分别为环境遮蔽、粗糙度、金属度；洞窟表面按非金属处理。

贴图随 `gallery.bundle.js` 一同打包，运行时无需请求 Poly Haven 或其他外部服务。壁画原始影像和色彩演示不使用这些表面纹理替换。
