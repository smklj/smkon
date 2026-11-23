/**
 * Troca de formato a partir do template, quando dá: o template oficial redesenha a
 * peça na proporção nova (marca no lugar certo). Sem template, editado à mão ou numa
 * proporção que o template não tem, cai na adaptação genérica (geometry.reflowScene).
 */
import type { SmartPostPackage } from "../../content/smart-post-generator.ts";
import type { SmartBannerConfig } from "../../media/smart-banner-engine.ts";
import { reflowScene, SCENE_FORMATS, type SceneFormat } from "../geometry.ts";
import type { SceneDocument } from "../types.ts";
import { bannerConfigFromScene, bannerConfigToScene } from "./smkon-banner.ts";
import { postPackageFromScene, postPackageToScene } from "./smkon-post.ts";

export type ReformatResult = { doc: SceneDocument; via: "template" | "reflow" };

export function reformatScene(doc: SceneDocument, format: SceneFormat): ReformatResult {
  const banner = bannerConfigFromScene(doc);
  if (banner && (format === "1:1" || format === "9:16")) {
    const config: SmartBannerConfig = { ...banner, aspectRatio: format };
    return { doc: bannerConfigToScene(config), via: "template" };
  }
  const post = postPackageFromScene(doc);
  if (post && (format === "1:1" || format === "4:5")) {
    const pkg: SmartPostPackage = { ...post, aspectRatio: format };
    return { doc: postPackageToScene(pkg), via: "template" };
  }
  const size = SCENE_FORMATS[format];
  return { doc: reflowScene(doc, size.width, size.height), via: "reflow" };
}
