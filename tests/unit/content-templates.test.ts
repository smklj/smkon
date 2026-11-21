import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_TEMPLATES, draftHasWriting, findTemplate, templateSubject } from "../../src/lib/content/templates.ts";
import { generateAutonomousDraft } from "../../src/lib/content/autonomous-generator.ts";
import { generateAutonomousPost } from "../../src/lib/content/smart-post-generator.ts";

test("modelos: ids únicos e todos geram rascunho com o produto informado", () => {
  assert.equal(new Set(CONTENT_TEMPLATES.map((template) => template.id)).size, CONTENT_TEMPLATES.length);
  for (const template of CONTENT_TEMPLATES) {
    if (template.group === "video") {
      const draft = generateAutonomousDraft(template.preset, "Fone XPTO");
      assert.ok(draft.script.length > 0 && draft.caption.length > 0, template.id);
    } else {
      const post = generateAutonomousPost(template.kind, "Fone XPTO");
      assert.ok(post.slides.length > 0, template.id);
    }
  }
  assert.equal(findTemplate("nao-existe"), undefined);
});

test("templateSubject: usa o produto do rascunho e nunca inventa um produto", () => {
  assert.equal(templateSubject({ product: " Fone XPTO ", title: "Review" }, "video"), "Fone XPTO");
  assert.equal(templateSubject({ product: "", title: "Review" }, "video"), "[nome do produto]");
  assert.equal(templateSubject({ product: "", title: "Comparativo de fones" }, "post"), "Comparativo de fones");
  assert.equal(templateSubject({ product: "", title: " " }, "post"), "[tema do post]");
});

test("draftHasWriting: só texto real pede confirmação antes de substituir", () => {
  assert.equal(draftHasWriting({ script: "", caption: "  ", cta: "", hashtags: "" }), false);
  assert.equal(draftHasWriting({ script: "", caption: "Legenda", cta: "", hashtags: "" }), true);
});
