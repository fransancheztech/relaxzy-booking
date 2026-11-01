-- Guidelines in several languages: one version per language, shown in the app's language.
--
-- Today a guideline is one block of text. Four of them carry English, Spanish and Thai one after
-- the other, separated by "---" (STAFF COORDINATION, COUPLES MASSAGE PROMOTION, VACATION POLICY,
-- BOOKINGS RULES), so every reader scrolls through all three. The other six are Spanish only.
--
-- New table guideline_translations: one row per guideline and language (es / en / th), each with
-- its own title and text. The guideline itself keeps what is shared by every version: who can see
-- it (target_roles), the author and the dates. The page shows the version in the app's language,
-- falling back ES → EN → TH when that version doesn't exist.
--
-- Data moved by this file:
--   * the 6 Spanish-only guidelines → one 'es' version each, title and text unchanged;
--   * the 4 trilingual ones → split at their two "---" lines into 'en', 'es' and 'th' versions.
--     The English version keeps the current title. The Spanish and Thai titles are NEW (proposed,
--     please check them in STEP 1 below). The Thai text of STAFF COORDINATION began with its own
--     bold title line; that line is now its Thai title and is no longer repeated in the text.
--     Apart from that, the split texts are the original text exactly, without the "---" lines.
--
-- guidelines.title / guidelines.content stay as they are, untouched, as a backup. The app will stop
-- using them; content becomes nullable so new guidelines don't have to fill it. A later migration
-- drops both columns once everything has been checked.
--
-- Same protection as the other app-only tables: RLS on with no policies, no access for
-- anon/authenticated — only the app (through Prisma, as postgres) reads or writes it.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new table → new Prisma model).


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Precondition (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: translations_table = NULL (not applied yet), active_guidelines = 10,
-- trilingual_unchanged = 4. If trilingual_unchanged is less than 4, one of those four guidelines
-- was edited after this file was written: STOP and ask for the file to be regenerated, or the
-- split texts below would overwrite the edit. STEP 1 checks this again and refuses to run.
SELECT to_regclass('public.guideline_translations') AS translations_table,
       (SELECT count(*) FROM public.guidelines WHERE deleted_at IS NULL) AS active_guidelines,
       (SELECT count(*) FROM public.guidelines
         WHERE (id, updated_at) IN (
           ('a3a1fc68-81d2-4e2f-a177-90079cd9dd87'::uuid, '2026-09-11 22:04:55.081057+00'::timestamptz),
           ('aea237cd-8618-4557-82df-0e7421a10517'::uuid, '2026-09-22 08:32:36.62+00'::timestamptz),
           ('3b7e7835-e100-4b6e-8a9b-d9107c5b5746'::uuid, '2026-10-12 19:47:33.668+00'::timestamptz),
           ('5ac0f1d8-a6dd-4031-826f-9048293217d2'::uuid, '2026-10-08 19:33:58.34+00'::timestamptz)
         )) AS trilingual_unchanged;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install and move the texts
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.guidelines
       WHERE (id, updated_at) IN (
         ('a3a1fc68-81d2-4e2f-a177-90079cd9dd87'::uuid, '2026-09-11 22:04:55.081057+00'::timestamptz),
         ('aea237cd-8618-4557-82df-0e7421a10517'::uuid, '2026-09-22 08:32:36.62+00'::timestamptz),
         ('3b7e7835-e100-4b6e-8a9b-d9107c5b5746'::uuid, '2026-10-12 19:47:33.668+00'::timestamptz),
         ('5ac0f1d8-a6dd-4031-826f-9048293217d2'::uuid, '2026-10-08 19:33:58.34+00'::timestamptz)
       )) <> 4 THEN
    RAISE EXCEPTION 'A trilingual guideline changed after this file was written: regenerate it.';
  END IF;
END $$;

CREATE TABLE public.guideline_translations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id  uuid        NOT NULL REFERENCES public.guidelines (id) ON DELETE CASCADE,
  language      text        NOT NULL,
  title         text,
  content       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guideline_translations_language_check CHECK (language IN ('es', 'en', 'th')),
  CONSTRAINT guideline_translations_content_not_blank CHECK (btrim(content) <> ''),
  CONSTRAINT guideline_translations_one_per_language UNIQUE (guideline_id, language)
);

COMMENT ON TABLE public.guideline_translations IS
  'One language version (es/en/th) of a guideline: its own title and text. Shown in the app''s language, falling back ES → EN → TH.';

ALTER TABLE public.guideline_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guideline_translations FROM anon, authenticated;

-- Kept as a backup until a later migration drops it; new guidelines no longer fill it.
ALTER TABLE public.guidelines ALTER COLUMN content DROP NOT NULL;

-- The 6 Spanish-only guidelines: copied whole, as the Spanish version.
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'es', title, content, created_at, updated_at
  FROM public.guidelines
 WHERE deleted_at IS NULL
   AND id NOT IN ('a3a1fc68-81d2-4e2f-a177-90079cd9dd87', 'aea237cd-8618-4557-82df-0e7421a10517',
                  '3b7e7835-e100-4b6e-8a9b-d9107c5b5746', '5ac0f1d8-a6dd-4031-826f-9048293217d2');

-- The 4 trilingual guidelines, split. Texts between $gl$ … $gl$ are literal.

-- STAFF COORDINATION & ESCALATION GUIDELINE — EN (2662 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'en', title, $gl$## PURPOSE:

This guideline explains how any suggestion, new way of working, or change of protocol — in any area of the business — must be handled before it is put into practice. It applies to every member of the team.

## THE RULE:

No staff member, receptionist or therapist, may adopt, request, or expect a colleague to adopt a new way of working or a change to an existing protocol that has not been approved and communicated by Chalida or Fran. This applies in every direction: therapist to receptionist, receptionist to therapist, therapist to therapist, and receptionist to receptionist. An indication given by one staff member to another, however reasonable it sounds, is not an instruction and must not be implemented.

## HOW IT WORKS:

- Ideas, observations and concerns go directly to Chalida or Fran, not to a colleague as an instruction.
- Keep working exactly as before while a suggestion is being evaluated.
- If a colleague insists after being told the matter is with the administrators, do not engage further, do not adopt the change, note it and inform Chalida or Fran. No one will face consequences for following this guideline.
- Approved changes are explained by Chalida or Fran to all affected staff at the same time. Until that happens, nothing changes.

## WHY:

Suggestions and initiative from the team are welcomed and valued — they are what makes the business better. The purpose of this guideline is not to silence them, but to turn them into a clear protocol that everyone receives identically, instead of an informal instruction that different people may hear, remember or interpret differently. It exists to make the job easier, not harder.

## EXAMPLES:

- Example 1: A therapist suggests to the receptionist that clients should be asked about health conditions before every massage. The receptionist values the idea, does not change how she works, and informs Chalida or Fran. The idea is developed properly and then explained formally to the whole team at once. If the therapist later insists that it be applied immediately, the receptionist does not apply it, does not argue, and reports the insistence.
- Example 2: A receptionist is unsure how to handle an unusual situation and asks a therapist what to do. The therapist should not instruct her; the situation goes to Chalida or Fran.

## CLOSING PRINCIPLE:

Decisions about how the business operates are made by Chalida and Fran, based on what the whole team brings to them. This guideline exists so that everyone always knows what is currently approved and what is still being evaluated. Following it takes priority over any indication received directly from a colleague.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'a3a1fc68-81d2-4e2f-a177-90079cd9dd87';

-- STAFF COORDINATION & ESCALATION GUIDELINE — ES (2845 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'es', 'GUÍA DE COORDINACIÓN Y ESCALADO DEL PERSONAL', $gl$## OBJETIVO:

Esta guía explica cómo debe gestionarse cualquier sugerencia, nueva forma de trabajar o cambio de protocolo — en cualquier área del negocio — antes de ponerse en práctica. Se aplica a todos los miembros del equipo.

## LA REGLA:

Ningún miembro del personal, recepcionista o terapeuta, puede adoptar, solicitar, ni esperar que un compañero adopte una nueva forma de trabajar o un cambio en un protocolo existente que no haya sido aprobado y comunicado por Chalida o Fran. Esto se aplica en todas las direcciones: de terapeuta a recepcionista, de recepcionista a terapeuta, de terapeuta a terapeuta, y de recepcionista a recepcionista. Una indicación dada por un miembro del personal a otro, por razonable que suene, no es una instrucción y no debe implementarse.

## CÓMO FUNCIONA:

- Las ideas, observaciones e inquietudes se comunican directamente a Chalida o Fran, no a un compañero en forma de instrucción.
- Seguir trabajando exactamente igual que antes mientras la sugerencia está siendo evaluada.
- Si un compañero insiste después de que se le haya dicho que el asunto está en manos de los administradores, no seguir discutiendo, no adoptar el cambio, anotarlo e informar a Chalida o Fran. Nadie sufrirá consecuencias por seguir esta guía.
- Los cambios aprobados los explican Chalida o Fran a todo el personal afectado al mismo tiempo. Hasta que eso ocurra, nada cambia.

## POR QUÉ:

Las sugerencias y la iniciativa del equipo son bienvenidas y valoradas — son lo que hace mejorar al negocio. El propósito de esta guía no es silenciarlas, sino convertirlas en un protocolo claro que todos reciban de forma idéntica, en lugar de en una instrucción informal que distintas personas puedan oír, recordar o interpretar de forma diferente. Existe para facilitar el trabajo, no para complicarlo.

## EJEMPLOS:

- Ejemplo 1: Una terapeuta sugiere a la recepcionista que se pregunte a los clientes por sus condiciones de salud antes de cada masaje. La recepcionista valora la idea, no cambia su forma de trabajar, e informa a Chalida o Fran. La idea se desarrolla adecuadamente y después se explica formalmente a todo el equipo a la vez. Si más tarde la terapeuta insiste en que se aplique de inmediato, la recepcionista no la aplica, no discute, e informa de la insistencia.
- Ejemplo 2: Una recepcionista no sabe cómo manejar una situación poco habitual y pregunta a una terapeuta qué hacer. La terapeuta no debe indicarle cómo proceder; la situación se traslada a Chalida o Fran.

## PRINCIPIO GENERAL:

Las decisiones sobre cómo se gestiona el negocio corresponden a Chalida y Fran, a partir de lo que todo el equipo les traslada. Esta guía existe para que todos sepan en cada momento qué está aprobado y qué está todavía en evaluación. Seguirla tiene prioridad sobre cualquier indicación recibida directamente de un compañero.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'a3a1fc68-81d2-4e2f-a177-90079cd9dd87';

-- STAFF COORDINATION & ESCALATION GUIDELINE — TH (its opening bold title line is now the title)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'th', 'แนวทางการประสานงานและการส่งต่อข้อเสนอแนะของพนักงาน', $gl$## วัตถุประสงค์:

แนวทางนี้อธิบายวิธีจัดการกับข้อเสนอแนะ วิธีการทำงานใหม่ หรือการเปลี่ยนแปลงขั้นตอนการทำงานใดๆ ในทุกด้านของธุรกิจ ก่อนที่จะนำไปปฏิบัติจริง และใช้กับสมาชิกทุกคนในทีม

## กฎ:

ไม่มีพนักงานคนใด ไม่ว่าจะเป็นพนักงานต้อนรับหรือนักบำบัด ที่สามารถนำไปปฏิบัติ ร้องขอ หรือคาดหวังให้เพื่อนร่วมงานนำวิธีการทำงานใหม่ หรือการเปลี่ยนแปลงขั้นตอนที่มีอยู่ ซึ่งยังไม่ได้รับการอนุมัติและสื่อสารจากชลิดาหรือฟราน ไปปฏิบัติ กฎนี้ใช้กับทุกทิศทาง: จากนักบำบัดถึงพนักงานต้อนรับ จากพนักงานต้อนรับถึงนักบำบัด จากนักบำบัดถึงนักบำบัด และจากพนักงานต้อนรับถึงพนักงานต้อนรับ คำแนะนำที่พนักงานคนหนึ่งให้กับอีกคนหนึ่ง ไม่ว่าจะฟังดูสมเหตุสมผลเพียงใด ไม่ถือเป็นคำสั่ง และต้องไม่นำไปปฏิบัติ

## วิธีปฏิบัติ:

- ความคิด ข้อสังเกต และข้อกังวล ให้แจ้งชลิดาหรือฟรานโดยตรง ไม่ใช่สั่งเพื่อนร่วมงาน
- ทำงานตามปกติเหมือนเดิมในระหว่างที่ข้อเสนอแนะกำลังถูกพิจารณา
- หากเพื่อนร่วมงานยืนยันต่อหลังจากได้รับแจ้งแล้วว่าเรื่องนี้อยู่ในการพิจารณาของผู้บริหาร ไม่ต้องโต้ตอบต่อ ไม่ต้องนำการเปลี่ยนแปลงไปปฏิบัติ ให้บันทึกไว้และแจ้งชลิดาหรือฟราน จะไม่มีใครได้รับผลกระทบจากการปฏิบัติตามแนวทางนี้
- การเปลี่ยนแปลงที่ได้รับอนุมัติแล้ว ชลิดาหรือฟรานจะอธิบายให้พนักงานที่เกี่ยวข้องทุกคนทราบพร้อมกัน จนกว่าจะถึงตอนนั้น ทุกอย่างยังคงเหมือนเดิม

## เหตุผล:

ข้อเสนอแนะและความคิดริเริ่มจากทีมเป็นสิ่งที่ได้รับการต้อนรับและมีคุณค่า เพราะเป็นสิ่งที่ทำให้ธุรกิจดีขึ้น วัตถุประสงค์ของแนวทางนี้ไม่ใช่การปิดกั้นความคิดเห็นเหล่านั้น แต่เพื่อเปลี่ยนให้เป็นขั้นตอนการทำงานที่ชัดเจนซึ่งทุกคนได้รับเหมือนกันทุกประการ แทนที่จะเป็นคำสั่งอย่างไม่เป็นทางการที่คนแต่ละคนอาจได้ยิน จดจำ หรือตีความแตกต่างกันไป แนวทางนี้มีไว้เพื่อทำให้การทำงานง่ายขึ้น ไม่ใช่ยากขึ้น

## ตัวอย่าง:

- ตัวอย่างที่ 1: นักบำบัดเสนอต่อพนักงานต้อนรับว่าควรถามลูกค้าเกี่ยวกับสภาวะสุขภาพก่อนการนวดทุกครั้ง พนักงานต้อนรับเห็นคุณค่าของความคิดนี้ แต่ไม่เปลี่ยนวิธีการทำงาน และแจ้งชลิดาหรือฟราน ความคิดนี้จะถูกพัฒนาอย่างเหมาะสมแล้วอธิบายให้ทั้งทีมทราบพร้อมกันอย่างเป็นทางการ หากภายหลังนักบำบัดยืนยันให้เริ่มปฏิบัติทันที พนักงานต้อนรับไม่ปฏิบัติตาม ไม่โต้แย้ง และรายงานการยืนยันนั้น
- ตัวอย่างที่ 2: พนักงานต้อนรับไม่แน่ใจว่าจะจัดการสถานการณ์ที่ไม่ปกติอย่างไร จึงถามนักบำบัดว่าควรทำอย่างไร นักบำบัดไม่ควรสั่งว่าควรดำเนินการอย่างไร ให้นำสถานการณ์นี้ไปแจ้งชลิดาหรือฟรานแทน

## หลักการปิดท้าย:

การตัดสินใจเกี่ยวกับวิธีการดำเนินธุรกิจเป็นของชลิดาและฟราน โดยอ้างอิงจากสิ่งที่ทีมทั้งหมดนำมาเสนอ แนวทางนี้มีไว้เพื่อให้ทุกคนทราบเสมอว่าขณะนี้อะไรได้รับการอนุมัติแล้ว และอะไรยังอยู่ระหว่างการพิจารณา การปฏิบัติตามแนวทางนี้มีความสำคัญเหนือกว่าคำแนะนำใดๆ ที่ได้รับโดยตรงจากเพื่อนร่วมงาน...$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'a3a1fc68-81d2-4e2f-a177-90079cd9dd87';

-- COUPLES MASSAGE PROMOTION — TERMS AND CONDITIONS — EN (3366 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'en', title, $gl$Active since 1st September 2026, until 31st October 2026.

## 1. Reason for the promotion

This promotion celebrates the second anniversary of Relaxzy Thai Massage.

## 2. Definition of group and couples

This promotion is designed for bookings of 2 or more people, organized into couples. A group of 2 people equals 1 couple; a group of 4, 2 couples; a group of 6, 3 couples; and so on. Each couple within the group is evaluated independently for discount purposes.

## 3. Time slot requirement

For a group booking to be considered as such and qualify for the discount, all massages must be carried out in the same time slot. Exception: if the inability to coincide in the same time slot is due to the spa's own lack of availability at the client's desired time, flexibility will be offered to assign different time slots to the affected members of the group, without losing the discount.

## 4. Discounts by duration

- 30-minute massages: no discount.
- 60-minute massages: €10 discount on the combined price of both massages in the couple.
- 90-minute massages: €15 discount on the combined price of both massages in the couple.

## 5. Mixing durations within a couple

- If a couple combines 60 and 90 minutes, the discount for the shorter duration applies (€10), i.e. both are treated as 60 minutes.
- If one member of the couple chooses a 30-minute massage, that couple loses the discount entirely (the 30-minute massage has no discount and does not allow the "shorter duration" rule from the previous point to apply).

## 6. Deep Tissue

The Deep Tissue massage never has a discount. If, within a couple, one or both members choose Deep Tissue, the discount is cancelled only for that couple, who will pay the combined price of both massages with no discount. The rest of the couples in the group keep their discount as normal, provided they meet the other conditions.

## 7. Calculating couples in larger groups

The number of couples eligible for the discount within a group is calculated as:
**Number of discounted couples = number of people in the group ÷ 2 (rounded down)**
Examples: group of 3 → 1 discounted couple, 1 person without discount. Group of 5 → 2 discounted couples, 1 person without discount. Group of 6 → 3 discounted couples. Each couple applies the discount corresponding to their own duration and massage choice (points 4, 5 and 6).

## 8. Forming couples in odd-numbered groups

In groups with an odd number of people, the group of clients themselves decides which member is left out of the promotion. Reception does not get involved in forming the couples or deciding who goes without the discount; it only applies the discount according to the grouping indicated by the client.

## 9. Gift cards

The promotion does not apply to the purchase or redemption of gift cards. These transactions are always processed at full price, with no discount.

## 10. Non-cumulative

This promotion cannot be combined with other offers, discounts, or loyalty programs.

## 11. Manual calculation

The discounted price calculation is entirely manual and must be carried out by the receptionist at the time of payment. The booking app and the POS system do not automate this calculation under any circumstance.

## 12. Traceability record

It is recommended to add a "Couples Promo" note to the notes of each booking that benefits from the discount.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'aea237cd-8618-4557-82df-0e7421a10517';

-- COUPLES MASSAGE PROMOTION — TERMS AND CONDITIONS — ES (3570 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'es', 'PROMOCIÓN DE MASAJE EN PAREJA — TÉRMINOS Y CONDICIONES', $gl$Activa desde el 1 de septiembre de 2026, hasta el 31 de octubre de 2026.

## 1. Motivo de la promoción

Esta promoción celebra el segundo aniversario de Relaxzy Thai Massage.

## 2. Definición de grupo y parejas

La promoción está pensada para reservas de 2 o más personas, organizadas en parejas. Un grupo de 2 personas equivale a 1 pareja; un grupo de 4, a 2 parejas; un grupo de 6, a 3 parejas; y así sucesivamente. Cada pareja dentro del grupo se evalúa de forma independiente a efectos de descuento.

## 3. Requisito de franja horaria

Para que una reserva en grupo sea considerada como tal y pueda aplicarse el descuento, los masajes deben ejecutarse en la misma franja horaria. Excepción: si la imposibilidad de coincidir en la misma franja horaria se debe a falta de disponibilidad del centro en el horario deseado por el cliente, se ofrecerá la flexibilidad de asignar franjas horarias distintas a los integrantes afectados, sin que esto suponga la pérdida del descuento.

## 4. Descuentos por duración

- Masajes de 30 minutos: sin descuento.
- Masajes de 60 minutos: 10 € de descuento sobre la suma del precio de ambos masajes de la pareja.
- Masajes de 90 minutos: 15 € de descuento sobre la suma del precio de ambos masajes de la pareja.

## 5. Mezcla de duraciones dentro de una pareja

- Si una pareja combina 60 y 90 minutos, se aplica el descuento correspondiente a la duración menor (10 €), es decir, se trata como si ambos fueran de 60 minutos.
- Si uno de los integrantes de la pareja elige un masaje de 30 minutos, esa pareja pierde el descuento por completo (el de 30 minutos no tiene descuento y no permite aplicar la regla de "duración menor" del punto anterior).

## 6. Deep Tissue

El masaje Deep Tissue no tiene descuento bajo ningún concepto. Si, dentro de una pareja, uno o ambos integrantes eligen Deep Tissue, el descuento se anula únicamente para esa pareja, que pagará la suma de ambos masajes sin descuento. El resto de parejas del grupo mantienen su descuento con normalidad, siempre que cumplan el resto de condiciones.

## 7. Cálculo de parejas en grupos grandes

El número de parejas con derecho a descuento dentro de un grupo se calcula como:
**Nº de parejas promocionadas = número de personas del grupo ÷ 2 (redondeando hacia abajo)**
Ejemplos: grupo de 3 → 1 pareja con descuento, 1 persona sin descuento. Grupo de 5 → 2 parejas con descuento, 1 persona sin descuento. Grupo de 6 → 3 parejas con descuento. Cada pareja aplica el descuento que le corresponda según su propia duración y elección de masaje (puntos 4, 5 y 6).

## 8. Formación de parejas en grupos impares

En grupos con número impar de personas, es el propio grupo de clientes quien decide qué integrante queda fuera de la promoción. Recepción no interviene en la formación de las parejas ni decide quién se queda sin descuento; únicamente aplica el descuento según la agrupación que el cliente indique.

## 9. Tarjetas regalo

La promoción no aplica a la compra ni al canje de tarjetas regalo. Estas operaciones se tramitan siempre a precio íntegro, sin descuento.

## 10. No acumulable

Esta promoción no es acumulable con otras ofertas, descuentos o programas de fidelización.

## 11. Cálculo manual

El cálculo del precio con descuento es totalmente manual y debe ser realizado por el/la recepcionista en el momento del cobro. La aplicación de reservas y el TPV no automatizan este cálculo bajo ningún concepto.

## 12. Registro de trazabilidad

Se recomienda añadir una nota "Promo parejas" en las notas de cada reserva que se vea beneficiada con el descuento.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'aea237cd-8618-4557-82df-0e7421a10517';

-- COUPLES MASSAGE PROMOTION — TERMS AND CONDITIONS — TH (2634 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'th', 'โปรโมชั่นนวดคู่ — ข้อกำหนดและเงื่อนไข', $gl$มีผลตั้งแต่วันที่ 1 กันยายน 2026 จนถึงวันที่ 31 ตุลาคม 2026

## 1. เหตุผลของโปรโมชั่น

โปรโมชั่นนี้จัดขึ้นเพื่อฉลองครบรอบ 2 ปีของ Relaxzy Thai Massage

## 2. คำนิยามของกลุ่มและคู่

โปรโมชั่นนี้ออกแบบมาสำหรับการจองตั้งแต่ 2 คนขึ้นไป โดยจัดเป็นคู่ กลุ่ม 2 คนเท่ากับ 1 คู่ กลุ่ม 4 คนเท่ากับ 2 คู่ กลุ่ม 6 คนเท่ากับ 3 คู่ และเป็นเช่นนี้ต่อไป แต่ละคู่ในกลุ่มจะได้รับการพิจารณาส่วนลดแยกจากกัน

## 3. เงื่อนไขเรื่องช่วงเวลา

เพื่อให้การจองแบบกลุ่มถือเป็นกลุ่มและสามารถรับส่วนลดได้ การนวดทุกคนต้องทำในช่วงเวลาเดียวกัน ข้อยกเว้น: หากไม่สามารถจัดให้อยู่ในช่วงเวลาเดียวกันได้เนื่องจากร้านไม่มีคิวว่างในช่วงเวลาที่ลูกค้าต้องการ ทางร้านจะยืดหยุ่นให้จัดช่วงเวลาที่แตกต่างกันสำหรับสมาชิกที่ได้รับผลกระทบ โดยไม่เสียสิทธิ์ส่วนลด

## 4. ส่วนลดตามระยะเวลา

- นวด 30 นาที: ไม่มีส่วนลด
- นวด 60 นาที: ลด 10 ยูโร จากราคารวมของทั้งคู่
- นวด 90 นาที: ลด 15 ยูโร จากราคารวมของทั้งคู่

## 5. การผสมระยะเวลาภายในคู่เดียวกัน

- หากคู่หนึ่งเลือกผสมระหว่าง 60 และ 90 นาที จะใช้ส่วนลดของระยะเวลาที่สั้นกว่า (10 ยูโร) กล่าวคือถือว่าทั้งคู่นวด 60 นาที
- หากสมาชิกคนใดคนหนึ่งในคู่เลือกนวด 30 นาที คู่นั้นจะไม่ได้รับส่วนลดเลย (การนวด 30 นาทีไม่มีส่วนลดและไม่สามารถใช้กฎ "ระยะเวลาสั้นกว่า" ตามข้อก่อนหน้าได้)

## 6. ดีพทิชชู่ (Deep Tissue)

การนวดดีพทิชชู่ไม่มีส่วนลดไม่ว่ากรณีใดๆ หากภายในคู่หนึ่ง มีคนใดคนหนึ่งหรือทั้งคู่เลือกดีพทิชชู่ ส่วนลดจะถูกยกเลิกเฉพาะคู่นั้น โดยจะต้องจ่ายราคารวมของทั้งสองการนวดแบบไม่มีส่วนลด คู่อื่นๆ ในกลุ่มยังคงได้รับส่วนลดตามปกติ ตราบใดที่เป็นไปตามเงื่อนไขอื่นๆ

## 7. การคำนวณจำนวนคู่ในกลุ่มใหญ่

จำนวนคู่ที่มีสิทธิ์ได้รับส่วนลดในกลุ่มคำนวณได้จาก:
**จำนวนคู่ที่ได้รับโปรโมชั่น = จำนวนคนในกลุ่ม ÷ 2 (ปัดเศษลง)**
ตัวอย่าง: กลุ่ม 3 คน → 1 คู่ได้รับส่วนลด, 1 คนไม่ได้รับส่วนลด กลุ่ม 5 คน → 2 คู่ได้รับส่วนลด, 1 คนไม่ได้รับส่วนลด กลุ่ม 6 คน → 3 คู่ได้รับส่วนลด แต่ละคู่จะใช้ส่วนลดตามระยะเวลาและประเภทการนวดของตนเอง (ตามข้อ 4, 5 และ 6)

## 8. การจัดคู่ในกลุ่มที่มีจำนวนคี่

ในกลุ่มที่มีจำนวนคนเป็นเลขคี่ ลูกค้าเป็นผู้ตัดสินใจเองว่าใครจะเป็นคนที่ไม่ได้รับโปรโมชั่น พนักงานต้อนรับจะไม่เข้าไปยุ่งเกี่ยวกับการจัดคู่หรือตัดสินใจว่าใครจะไม่ได้รับส่วนลด เพียงแค่ใช้ส่วนลดตามการจัดกลุ่มที่ลูกค้าแจ้งเท่านั้น

## 9. บัตรของขวัญ

โปรโมชั่นนี้ไม่สามารถใช้กับการซื้อหรือแลกบัตรของขวัญได้ รายการเหล่านี้จะคิดราคาเต็มเสมอ โดยไม่มีส่วนลด

## 10. ไม่สามารถใช้ร่วมกับโปรโมชั่นอื่นได้

โปรโมชั่นนี้ไม่สามารถใช้ร่วมกับข้อเสนอ ส่วนลด หรือโปรแกรมสะสมแต้มอื่นๆ ได้

## 11. การคำนวณด้วยตนเอง

การคำนวณราคาส่วนลดทำด้วยตนเองทั้งหมด และต้องดำเนินการโดยพนักงานต้อนรับในขณะรับชำระเงิน ระบบจองและเครื่อง POS ไม่มีการคำนวณอัตโนมัติในกรณีนี้เลย

## 12. การบันทึกเพื่อการตรวจสอบ

แนะนำให้เพิ่มโน้ต "โปรโมชั่นคู่" (Promo parejas) ในหมายเหตุของการจองทุกรายการที่ได้รับส่วนลดนี้...$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = 'aea237cd-8618-4557-82df-0e7421a10517';

-- VACATION POLICY — EN (2509 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'en', title, $gl$- Staff shall be entitled to 22 working days of annual vacation, or the corresponding proportional part.
- For the purposes of vacation entitlement, working days shall be considered those on which the employee would have been required to work, in accordance with the work calendar and the employee's shift schedule. Public holidays, weekly rest days, and days on which the employee has no obligation to work under their working time arrangement shall not count as vacation days.
- Each employee may only take the vacation days they have accrued to date.
- Preliminary vacation dates shall be submitted before March 31 or, for employees who join the company after that date, three months before the vacation is to be taken. These shall be provisional and subject to approval based on organizational needs and service coverage. Subsequent changes should be requested with a minimum of 15 days' notice and shall be subject to company approval.
- The company shall not be liable for any expenses incurred by the employee as a result of planning vacation before the company has confirmed the dates.
- In order to ensure service continuity, vacation shall be encouraged, as far as possible, during periods of lower workload as determined by the company for each year. Such periods may vary according to business needs.
- As a general rule, and by mutual agreement, vacation shall preferably be organized according to one of the following arrangements:

  1. 1 week + 1 week + 2 weeks + individual days, grouping individual days together where possible to facilitate service organization.
  2. 2 weeks + 2 weeks + individual days, grouping individual days together where possible to facilitate service organization.

  Any other arrangement shall require express company approval.

- In the event of conflicting requests for the same dates, an annual rotation system shall be applied to ensure fairness.
- The company may limit the number of staff on vacation simultaneously to ensure proper service delivery.
- This policy supplements the provisions of the applicable collective bargaining agreement and current labor legislation.

> **In summary:** You are entitled to 22 working days of vacation per year. Let us know your preferred dates before March 31 (or, if you joined later, three months before the requested date), and we will confirm two months before the vacation date. Try to organize your days off in blocks of 1 or 2 weeks, and if two people request the same dates, we rotate annually to keep it fair.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '3b7e7835-e100-4b6e-8a9b-d9107c5b5746';

-- VACATION POLICY — ES (2674 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'es', 'POLÍTICA DE VACACIONES', $gl$- El personal dispondrá de 22 días laborables de vacaciones anuales, o la parte proporcional correspondiente.
- A efectos del disfrute de vacaciones, se considerarán días laborables aquellos que, conforme al calendario laboral y al cuadrante de turnos del trabajador, hubieran correspondido como días de trabajo efectivo. No se computarán como días de vacaciones los festivos, los días de descanso semanal ni aquellos en los que el trabajador no tuviera obligación de prestar servicios conforme a su régimen de jornada.
- Cada trabajador solo podrá disfrutar los días que lleve devengados.
- Las fechas preliminares se elegirán antes del 31 de marzo o, para quienes se incorporen con posterioridad, con tres meses de antelación a su disfrute. Estas tendrán carácter provisional y quedarán sujetas a validación según necesidades organizativas y cobertura del servicio. Las modificaciones posteriores deberán solicitarse con un mínimo de 15 días de antelación y estarán sujetas a validación por la empresa.
- La empresa no se hace responsable de los gastos en que incurra el trabajador por planificar unas vacaciones antes de que la empresa haya confirmado las fechas.
- Con el objetivo de garantizar la continuidad del servicio, se priorizará, en la medida de lo posible, el disfrute de vacaciones en periodos de menor carga de trabajo determinados por la empresa para cada anualidad. Dichos periodos podrán variar según las necesidades del negocio.
- Con carácter general, y de mutuo acuerdo, las vacaciones se organizarán preferentemente conforme a alguna de las siguientes modalidades:

  1. 1 semana + 1 semana + 2 semanas + días sueltos, procurando agrupar los días sueltos para facilitar la organización del servicio.
  2. 2 semanas + 2 semanas + días sueltos, procurando agrupar los días sueltos para facilitar la organización del servicio.

  Cualquier otra distribución requerirá aprobación expresa de la empresa.

- En caso de conflicto entre solicitudes coincidentes, se aplicará un sistema de rotación anual para garantizar la equidad.
- La empresa podrá limitar el número de personas simultáneamente de vacaciones para garantizar la correcta prestación del servicio.
- La presente normativa complementa lo dispuesto en el convenio colectivo y en la legislación laboral vigente.

> **En resumen:** Tenéis 22 días laborables al año. Antes del 31 de marzo, o si habéis entrado más tarde, tres meses antes de la fecha pedida, nos decís cuándo os gustaría cogerlos, y dos meses antes de la fecha de disfrute, os confirmamos. Intentad organizarlos en bloques de una o dos semanas, y si dos personas queréis las mismas fechas, vamos rotando cada año para que sea justo.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '3b7e7835-e100-4b6e-8a9b-d9107c5b5746';

-- VACATION POLICY — TH (1954 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'th', 'นโยบายการลาพักร้อน', $gl$- พนักงานมีสิทธิลาพักร้อนได้ 22 วันทำการต่อปี หรือตามสัดส่วนที่สอดคล้องกับระยะเวลาการทำงาน
- สำหรับการนับวันลาพักร้อน วันทำการหมายถึงวันที่พนักงานต้องปฏิบัติงานจริงตามปฏิทินการทำงานและตารางกะของพนักงาน วันหยุดนักขัตฤกษ์ วันหยุดประจำสัปดาห์ และวันที่พนักงานไม่มีหน้าที่ต้องปฏิบัติงานตามระบบเวลาทำงานของตน จะไม่นับเป็นวันลาพักร้อน
- พนักงานแต่ละคนสามารถใช้สิทธิลาพักร้อนได้เฉพาะจำนวนวันที่สะสมแล้วเท่านั้น
- พนักงานต้องแจ้งวันลาพักร้อนเบื้องต้นก่อนวันที่ 31 มีนาคม หรือสำหรับพนักงานที่เริ่มงานหลังจากวันดังกล่าว ให้แจ้งล่วงหน้าสามเดือนก่อนวันลา วันลาดังกล่าวถือเป็นการแจ้งเบื้องต้นและต้องได้รับการอนุมัติตามความจำเป็นขององค์กรและการจัดกำลังคน การเปลี่ยนแปลงภายหลังควรแจ้งล่วงหน้าอย่างน้อย 15 วัน และต้องได้รับการอนุมัติจากบริษัท
- บริษัทจะไม่รับผิดชอบค่าใช้จ่ายใด ๆ ที่เกิดขึ้นจากการที่พนักงานวางแผนวันลาพักร้อนก่อนที่บริษัทจะยืนยันวันลา
- เพื่อรับประกันความต่อเนื่องของการให้บริการ บริษัทจะส่งเสริมให้ใช้สิทธิลาพักร้อนในช่วงที่มีปริมาณงานน้อยเท่าที่เป็นไปได้ โดยบริษัทจะกำหนดช่วงเวลาดังกล่าวเป็นรายปี ซึ่งอาจเปลี่ยนแปลงได้ตามความจำเป็นทางธุรกิจ
- โดยทั่วไปและโดยข้อตกลงร่วมกัน การลาพักร้อนควรจัดตามรูปแบบใดรูปแบบหนึ่งต่อไปนี้:

  1. 1 สัปดาห์ + 1 สัปดาห์ + 2 สัปดาห์ + วันเดี่ยว โดยพยายามรวมวันเดี่ยวเข้าด้วยกันเพื่อความสะดวกในการจัดตารางงาน
  2. 2 สัปดาห์ + 2 สัปดาห์ + วันเดี่ยว โดยพยายามรวมวันเดี่ยวเข้าด้วยกันเพื่อความสะดวกในการจัดตารางงาน

  การจัดรูปแบบอื่นใดต้องได้รับอนุมัติจากบริษัทอย่างชัดเจน

- ในกรณีที่มีการขอลาพักร้อนในช่วงเวลาเดียวกัน จะใช้ระบบหมุนเวียนรายปีเพื่อความเป็นธรรม
- บริษัทอาจจำกัดจำนวนพนักงานที่ลาพักร้อนพร้อมกันเพื่อรับประกันการให้บริการที่เหมาะสม
- ระเบียบนี้เป็นส่วนเสริมของข้อตกลงร่วมและกฎหมายแรงงานที่บังคับใช้

> **สรุป:** พนักงานมีสิทธิลาพักร้อน 22 วันทำการต่อปี แจ้งวันลาที่ต้องการก่อนวันที่ 31 มีนาคม หรือหากเริ่มงานหลังจากนั้น ให้แจ้งล่วงหน้าสามเดือนก่อนวันที่ต้องการลา และบริษัทจะยืนยันสองเดือนก่อนวันลา พยายามจัดวันลาเป็นช่วงละ 1 หรือ 2 สัปดาห์ หากมีพนักงานขอลาในช่วงเดียวกัน จะใช้ระบบหมุนเวียนรายปีเพื่อความเป็นธรรม$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '3b7e7835-e100-4b6e-8a9b-d9107c5b5746';

-- BOOKINGS RULES — EN (8363 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'en', title, $gl$## AUTHORITY & DECISION-MAKING (WHO DECIDES WHAT):

- The booking management is fully 100% responsibility of the receptionist. It is strictly forbidden for therapists to influence, move, cancel, reassign, or swap bookings or clients in any way that affects the daily course. Also, the receptionist will not ask therapists for guidance about when, how, who or by who a booking will be done, as the guidance may not be accurate and could lead to misalignments. Any question or inquiry about bookings, either by the receptionist or any therapist, must be asked directly to Chalida or Fran, not be solved among staff members.
- If a therapist insists on a schedule change after being told no, the receptionist should not engage further. The receptionist should note the request and inform Chalida or Fran. The receptionist will not face consequences for following these rules, even if a therapist is unhappy with the outcome.
- Therapists may offer observations (e.g., 'I think there's a gap in the afternoon'), and the receptionist is welcome to consider them - but the decision remains of the receptionist, and the receptionist is not obligated to act on suggestions.

## SCHEDULING CONSTRAINTS (THE HARD NUMBERS):

- The therapist working hours is from 11:00 to 20:00. Every therapist is expected to do the last massage at 19:30 as latest.
- Maximum booked daily hours: 7 hours, allowing 7:30 only 2 days in the last 7 days as an exception. 7 days in a row having every therapist more than 6 hours assigned must be communicated to Chalida or Fran, as this may be a sign of therapist lacking, and it may need to be studied.
- Maximum booked hours in a row: 3 hours. After every 3 hours in a row, every therapist will have a 15-minute break.
- Minimum eating time: 30 minutes.
- Preferred eating time: 12:30 to 2:30.

## ASSIGNMENT LOGIC (HOW TO DISTRIBUTE WORK FAIRLY):

- The amount of daily hours worked by every therapist should be as much balanced as possible. For example, therapists A and B getting 5 hours and C getting 4 hours, is better than therapist A and B getting 4 hours and C getting 6 hours.
- Client assignment is based on availability, rotation, and schedule balance — never on client history, preferences expressed by therapists, or expected tips. If a client requests a specific therapist, the receptionist honors it; if no request is made, it follows the rotation.
- Every therapist should be treated equally regarding bookings.
- Therapists who did not work the previous day for any reason (weekly day off, vacation, sick leave, just joined our team, etc.) will have priority of assignment for new bookings over other therapists who did work the previous day. If several therapists qualify, prioritize the one who has been away the longest. This isn't a strict rule - demand, daily hours balance among therapists and coherent rotation have priority over this rule.
- Bookings are dynamic, not static. A session assigned to a therapist may receive changes throughout its entire lifecycle — from the moment it is created and confirmed, until the service is completed. These changes may affect, or be motivated by: therapist assignment, duration extensions, day and/or time changes, companion additions, cancellations, etc. Changes in one session may also trigger adjustments in other sessions as a consequence.

The receptionist should think of bookings as movable game pieces: the environment constantly presents opportunities to rearrange them or even remove them. When such opportunities arise, the receptionist must evaluate whether to accept or refuse the change, and if accepted, determine its scope — whether it affects only one session or also the sessions around it.

The goals that guide whether a change should be made are:

1. Business productivity and revenue.
2. Equalitarianism in how bookings are assigned to therapists.

Changes that increase business productivity and revenue, without affecting any client-requested therapist assignment or negatively impacting therapist equalitarianism, are highly eligible to be performed. On the other hand, consequences such as decreasing business productivity or revenue, unassigning a therapist specifically requested by a client, or requiring a call to a client for reconfirmation of a different day or time, make changes less eligible.

The receptionist is also expected to be proactive when circumstances change during the day (e.g., cancellations), rebalancing assignments to maintain fairness and productivity rather than leaving the original plan untouched.

## EXAMPLES:

- Example 1: Therapist A and B worked yesterday. Therapist C did NOT work yesterday. The three therapists have already worked exactly 3 hours today. The next booking gets assigned to therapist C by previous-day-off preference.
- Example 2: Same as Example 1 but therapist C has already worked 4 hours, 1 more than therapist A and B. The next booking gets assigned to therapist A or B by daily-hours-balance preference.
- Example 3: Same as Example 1, but it's 4 o'clock and the receptionist receives a phone call, requesting a booking at 6pm. The booking gets assigned to therapist C by previous-day-off preference. 10 minutes later, the receptionist receives a new phone call, requesting another booking for 5:00pm. The receptionist reassigns the 6pm booking to therapists A or B, and assigns the booking at 5:00pm to therapist C by previous-day-off preference.
- Example 4: It's 10:55am and the working day is about to begin. Therapist A and B worked yesterday. Therapist C did NOT work yesterday. We have today two bookings at 11am and one at 11:30am where the client is requesting therapist C if possible. Therapist C gets assigned the booking at 11:30am by client-request preference and therapists A and B get the ones at 11am.
- Example 5: Therapist A and B worked already 3 hours and therapist C worked 5 hours (with a 30 minute break at the middle). Everybody worked yesterday. A client just walks in requesting therapist C. The booking gets assigned to therapist C by client-request priority.
- Example 6: Same as Example 5, but therapist C just finished her last massage of a 5 hours in a row chain of massages (max-hours-in-a-row rule violated). The walkin client that requests therapist C, cannot have their massage other than right now and does not want another therapist, so we need to decide to take it or leave it. This example depends on many factors so there is not a "best" choice. The correct thing is to ask Chalida or Fran attaching a photo of the agenda, for cases as tricky as this. We don't believe cases like this will be very frequent, if they become frequent, we will tailor specific rules to treat them.
- Example 7: Therapist A has two massages assigned: 11:00–12:00 and 12:00–13:00. No client in either session requested therapist A specifically. During the first massage, the client asks to extend their session by one more hour. Other therapists are available from 12:00 to 13:00. The receptionist should reassign therapist A's second session to an available therapist and let therapist A continue with the extended session. Two sessions are affected, but the change has no negative drawback and increases business productivity and revenue.
- Example 8: The day starts at 11:00 with two therapists working and 14 bookings equally assigned (7 to therapist A, 7 to therapist B). During the day, 4 of therapist B's clients cancel their appointments. The receptionist should not leave the day with 7 bookings for therapist A and 3 for therapist B. She is expected to reactively reassign the most eligible bookings to rebalance the workload, approximating as closely as possible to 5 sessions for each therapist.

> **Summary:** The order of importance for the rules is: 1. 30-minute-minimum-eating-time, 2. client-request, 3. balance, 4. previous-day-off, 5. Preferred eating window.
>
> Max-hours-in-a-row and 7-hour-daily-max-hours are very important rules too, first priority or second priority, but it's unclear to us how important they are if they clash with some other rules. Additional guidelines will be tailored if certain rule clashes become frequent.

## CLOSING PRINCIPLE:

- These rules are designed to protect both therapist wellbeing and business operations. Following them takes priority over individual preferences or comfort requests that fall outside the rules.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '5ac0f1d8-a6dd-4031-826f-9048293217d2';

-- BOOKINGS RULES — ES (9204 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'es', 'NORMAS DE RESERVAS', $gl$## AUTORIDAD Y TOMA DE DECISIONES (QUIÉN DECIDE QUÉ):

- La gestión de reservas es responsabilidad 100% de la recepcionista. Está estrictamente prohibido que las terapeutas influyan, muevan, cancelen, reasignen o intercambien reservas o clientes de cualquier forma que afecte al curso diario. Asimismo, la recepcionista no pedirá orientación a las terapeutas sobre cuándo, cómo, a quién o por quién se realizará una reserva, ya que dicha orientación podría no ser precisa y generar desajustes. Cualquier pregunta o consulta sobre reservas, ya sea por parte de la recepcionista o de cualquier terapeuta, debe dirigirse directamente a Chalida o Fran, y no resolverse entre el personal.
- Si una terapeuta insiste en un cambio de horario después de que se le haya dicho que no, la recepcionista no debe seguir discutiendo. La recepcionista debe anotar la solicitud e informar a Chalida o Fran. La recepcionista no sufrirá consecuencias por seguir estas normas, aunque una terapeuta esté disconforme con el resultado.
- Las terapeutas pueden hacer observaciones (por ejemplo, "creo que hay un hueco por la tarde"), y la recepcionista es libre de tenerlas en cuenta, pero la decisión es de la recepcionista, y no está obligada a actuar según las sugerencias.

## RESTRICCIONES DE HORARIO (LOS NÚMEROS):

- El horario laboral de las terapeutas es de 11:00 a 20:00. Se espera que cada terapeuta realice el último masaje a las 19:30 como máximo.
- Máximo de horas reservadas al día: 7 horas, permitiéndose 7:30 solo 2 días en los últimos 7 días como excepción. Si durante 7 días seguidos todas las terapeutas tienen más de 6 horas asignadas, debe comunicarse a Chalida o Fran, ya que puede ser señal de falta de personal y podría necesitar ser evaluado.
- Máximo de horas reservadas seguidas: 3 horas. Tras cada 3 horas seguidas, cada terapeuta tendrá un descanso de 15 minutos.
- Tiempo mínimo para comer: 30 minutos.
- Horario preferente para comer: de 12:30 a 14:30.

## LÓGICA DE ASIGNACIÓN (CÓMO DISTRIBUIR EL TRABAJO DE FORMA JUSTA):

- La cantidad de horas diarias trabajadas por cada terapeuta debe estar lo más equilibrada posible. Por ejemplo, que las terapeutas A y B tengan 5 horas y la terapeuta C tenga 4 horas es mejor que las terapeutas A y B tengan 4 horas y la terapeuta C tenga 6 horas.
- La asignación de clientes se basa en disponibilidad, rotación y equilibrio de horario — nunca en el historial del cliente, preferencias expresadas por las terapeutas ni propinas esperadas. Si un cliente solicita una terapeuta específica, la recepcionista lo respeta; si no hay solicitud, se sigue la rotación.
- Todas las terapeutas deben ser tratadas de forma igualitaria en lo que respecta a las reservas.
- Terapeutas que no trabajaron el día anterior por cualquier motivo (día libre semanal, vacaciones, baja por enfermedad, recién incorporada al equipo, etc.) tendrán prioridad de asignación para nuevas reservas sobre otras terapeutas que sí trabajaron el día anterior. Si varias terapeutas cumplen el criterio, priorizar a la que lleve más tiempo sin trabajar. Esta no es una regla estricta - la demanda, el equilibrio de horas diarias entre terapeutas y una rotación coherente tienen prioridad sobre esta regla.
- Las reservas son dinámicas, no estáticas. Una sesión asignada a una terapeuta puede recibir cambios a lo largo de todo su ciclo de vida — desde el momento en que se crea y confirma, hasta que el servicio se completa. Estos cambios pueden afectar, o estar motivados por: asignación de terapeuta, extensiones de duración, cambios de día y/o hora, adición de acompañantes, cancelaciones, etc. Los cambios en una sesión también pueden provocar ajustes en otras sesiones como consecuencia.

La recepcionista debe pensar en las reservas como piezas de juego movibles: el entorno presenta constantemente oportunidades para reorganizarlas o incluso eliminarlas. Cuando surjan estas oportunidades, la recepcionista debe evaluar si acepta o rechaza el cambio, y si lo acepta, determinar su alcance — si afecta solo a una sesión o también a las sesiones circundantes.

Los objetivos que guían si un cambio debe realizarse son:

1. Productividad y facturación del negocio.
2. Igualitarismo en cómo se asignan las reservas a las terapeutas.

Cambios que aumentan la productividad y facturación del negocio, sin afectar a ninguna asignación de terapeuta solicitada por un cliente ni impactar negativamente en el igualitarismo entre terapeutas, son altamente elegibles para ser realizados. Por otro lado, consecuencias como disminuir la productividad o facturación del negocio, desasignar a una terapeuta solicitada específicamente por un cliente, o requerir una llamada al cliente para reconfirmar un día u hora diferente, hacen que los cambios sean menos elegibles.

También se espera que la recepcionista sea proactiva cuando las circunstancias cambien durante el día (por ejemplo, cancelaciones), reequilibrando las asignaciones para mantener la equidad y la productividad en lugar de dejar el plan original intacto.

## EJEMPLOS:

- Ejemplo 1: Las terapeutas A y B trabajaron ayer. La terapeuta C NO trabajó ayer. Las tres terapeutas ya han trabajado exactamente 3 horas hoy. La siguiente reserva se asigna a la terapeuta C por preferencia de día-libre-previo.
- Ejemplo 2: Igual que el Ejemplo 1, pero la terapeuta C ya ha trabajado 4 horas, 1 más que las terapeutas A y B. La siguiente reserva se asigna a la terapeuta A o B por preferencia de equilibrio-de-horas-diarias.
- Ejemplo 3: Igual que el Ejemplo 1, pero son las 4 de la tarde y la recepcionista recibe una llamada telefónica solicitando una reserva a las 6pm. La reserva se asigna a la terapeuta C por preferencia de día-libre-previo. 10 minutos después, la recepcionista recibe otra llamada solicitando otra reserva para las 5:00pm. La recepcionista reasigna la reserva de las 6pm a las terapeutas A o B, y asigna la reserva de las 5:00pm a la terapeuta C por preferencia de día-libre-previo.
- Ejemplo 4: Son las 10:55am y la jornada laboral está a punto de comenzar. Las terapeutas A y B trabajaron ayer. La terapeuta C NO trabajó ayer. Hoy tenemos dos reservas a las 11am y una a las 11:30am donde el cliente solicita a la terapeuta C si es posible. La terapeuta C se asigna a la reserva de las 11:30am por preferencia de solicitud-de-cliente y las terapeutas A y B reciben las de las 11am.
- Ejemplo 5: Las terapeutas A y B ya han trabajado 3 horas y la terapeuta C ha trabajado 5 horas (con un descanso de 30 minutos en medio). Todas trabajaron ayer. Un cliente entra sin cita solicitando a la terapeuta C. La reserva se asigna a la terapeuta C por prioridad de solicitud-de-cliente.
- Ejemplo 6: Igual que el Ejemplo 5, pero la terapeuta C acaba de terminar su último masaje de una cadena de 5 horas seguidas de masajes (regla de máximo-de-horas-seguidas violada). El cliente sin cita que solicita a la terapeuta C no puede recibir su masaje en otro momento y no quiere otra terapeuta, así que debemos decidir si aceptarlo o rechazarlo. Este ejemplo depende de muchos factores, por lo que no hay una "mejor" opción. Lo correcto es consultar a Chalida o Fran adjuntando una foto de la agenda, para casos tan complicados como este. No creemos que casos como este sean muy frecuentes; si se vuelven frecuentes, crearemos reglas específicas para tratarlos.
- Ejemplo 7: La terapeuta A tiene dos masajes asignados: de 11:00 a 12:00 y de 12:00 a 13:00. Ningún cliente de ninguna de las dos sesiones solicitó específicamente a la terapeuta A. Durante el primer masaje, el cliente pide ampliar su sesión una hora más. Hay otras terapeutas disponibles de 12:00 a 13:00. La recepcionista debe reasignar la segunda sesión de la terapeuta A a una terapeuta disponible y dejar que la terapeuta A continúe con la sesión ampliada. Dos sesiones se ven afectadas, pero el cambio no tiene ningún inconveniente y aumenta la productividad y facturación del negocio.
- Ejemplo 8: El día comienza a las 11:00 con dos terapeutas trabajando y 14 reservas asignadas equitativamente (7 a la terapeuta A, 7 a la terapeuta B). Durante el día, 4 de los clientes de la terapeuta B cancelan sus citas. La recepcionista no debe dejar el día con 7 reservas para la terapeuta A y 3 para la terapeuta B. Se espera que reasigne reactivamente las reservas más elegibles para reequilibrar la carga de trabajo, aproximándose lo máximo posible a 5 sesiones para cada terapeuta.

> **Resumen:** El orden de importancia de las reglas es: 1. tiempo-mínimo-de-comida-30-minutos, 2. solicitud-de-cliente, 3. equilibrio, 4. día-libre-previo, 5. horario preferente de comida.
>
> Las reglas de máximo-de-horas-seguidas y máximo-de-7-horas-diarias también son reglas muy importantes, de primera o segunda prioridad, pero no tenemos claro cómo de importantes son si entran en conflicto con algunas otras reglas. Se crearán directrices adicionales si ciertos conflictos entre reglas se vuelven frecuentes.

## PRINCIPIO GENERAL:

- Estas normas están diseñadas para proteger tanto el bienestar de las terapeutas como el funcionamiento del negocio. Su cumplimiento tiene prioridad sobre preferencias individuales o solicitudes de comodidad que queden fuera de estas normas.$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '5ac0f1d8-a6dd-4031-826f-9048293217d2';

-- BOOKINGS RULES — TH (7224 characters)
INSERT INTO public.guideline_translations (guideline_id, language, title, content, created_at, updated_at)
SELECT id, 'th', 'กฎการจองคิว', $gl$## อำนาจและการตัดสินใจ (ใครเป็นผู้ตัดสินใจ):

- การจัดการการจองเป็นความรับผิดชอบของพนักงานต้อนรับ 100% ห้ามมิให้นักบำบัดมีอิทธิพล ย้าย ยกเลิก มอบหมายใหม่ หรือสลับการจองหรือลูกค้าในลักษณะใดก็ตามที่กระทบต่อการดำเนินงานประจำวัน นอกจากนี้ พนักงานต้อนรับจะไม่ขอคำแนะนำจากนักบำบัดเกี่ยวกับว่าจะจองเมื่อไหร่ อย่างไร ให้ใคร หรือโดยใคร เนื่องจากคำแนะนำอาจไม่ถูกต้องและอาจทำให้เกิดความสับสน คำถามหรือข้อสงสัยใดๆ เกี่ยวกับการจอง ไม่ว่าจะจากพนักงานต้อนรับหรือนักบำบัด ต้องถามชลิดาหรือฟรานโดยตรง ห้ามแก้ไขปัญหากันเองระหว่างพนักงาน
- หากนักบำบัดยืนยันที่จะเปลี่ยนตารางเวลาหลังจากถูกปฏิเสธแล้ว พนักงานต้อนรับไม่ควรโต้ตอบต่อ พนักงานต้อนรับควรบันทึกคำขอและแจ้งชลิดาหรือฟราน พนักงานต้อนรับจะไม่ได้รับผลกระทบใดๆ จากการปฏิบัติตามกฎเหล่านี้ แม้ว่านักบำบัดจะไม่พอใจกับผลลัพธ์ก็ตาม
- นักบำบัดสามารถเสนอข้อสังเกตได้ (เช่น "ฉันคิดว่าช่วงบ่ายมีช่วงว่าง") และพนักงานต้อนรับยินดีรับฟัง — แต่การตัดสินใจเป็นของพนักงานต้อนรับ และพนักงานต้อนรับไม่มีภาระผูกพันที่จะต้องทำตามข้อเสนอแนะ

## ข้อจำกัดด้านตารางเวลา (ตัวเลขที่ต้องปฏิบัติตาม):

- เวลาทำงานของนักบำบัดคือ 11:00 ถึง 20:00 นักบำบัดทุกคนต้องทำนวดครั้งสุดท้ายไม่เกิน 19:30
- ชั่วโมงจองสูงสุดต่อวัน: 7 ชั่วโมง อนุญาตให้ 7:30 ได้เพียง 2 วันในรอบ 7 วันที่ผ่านมาเป็นข้อยกเว้น หากนักบำบัดทุกคนมีชั่วโมงงานมากกว่า 6 ชั่วโมงติดต่อกัน 7 วัน ต้องแจ้งชลิดาหรือฟราน เพราะอาจเป็นสัญญาณว่าขาดนักบำบัด และอาจต้องพิจารณาเพิ่มเติม
- ชั่วโมงจองสูงสุดติดต่อกัน: 3 ชั่วโมง หลังจากทำงานติดต่อกันครบ 3 ชั่วโมง นักบำบัดแต่ละคนจะมีเวลาพัก 15 นาที
- เวลาพักกินอาหารขั้นต่ำ: 30 นาที
- ช่วงเวลากินอาหารที่แนะนำ: 12:30 ถึง 14:30

## หลักการมอบหมายงาน (การกระจายงานอย่างยุติธรรม):

- จำนวนชั่วโมงงานประจำวันของนักบำบัดแต่ละคนควรมีความสมดุลมากที่สุดเท่าที่จะเป็นไปได้ ตัวอย่างเช่น นักบำบัด A และ B ทำงาน 5 ชั่วโมง และนักบำบัด C ทำงาน 4 ชั่วโมง ดีกว่านักบำบัด A และ B ทำงาน 4 ชั่วโมง และนักบำบัด C ทำงาน 6 ชั่วโมง
- การมอบหมายลูกค้าขึ้นอยู่กับความพร้อม การหมุนเวียน และความสมดุลของตารางงาน — ไม่ใช่ประวัติลูกค้า ความชอบที่นักบำบัดแสดงออก หรือทิปที่คาดว่าจะได้รับ หากลูกค้าขอนักบำบัดเฉพาะคน พนักงานต้อนรับจะทำตามคำขอ หากไม่มีคำขอ ให้ปฏิบัติตามการหมุนเวียน
- นักบำบัดทุกคนต้องได้รับการปฏิบัติอย่างเท่าเทียมกันในเรื่องการจอง
- นักบำบัดที่ไม่ได้ทำงานในวันก่อนหน้าไม่ว่าด้วยเหตุผลใด (วันหยุดประจำสัปดาห์ วันหยุดพักร้อน ลาป่วย เพิ่งเข้าร่วมทีม ฯลฯ) จะมีสิทธิ์ได้รับมอบหมายการจองใหม่ก่อนนักบำบัดคนอื่นที่ทำงานในวันก่อนหน้า หากมีนักบำบัดหลายคนที่เข้าเกณฑ์ ให้ให้สิทธิ์ก่อนแก่ผู้ที่หยุดงานนานที่สุด นี่ไม่ใช่กฎเคร่งครัด - ความต้องการของลูกค้า ความสมดุลของชั่วโมงงานประจำวันระหว่างนักบำบัด และการหมุนเวียนที่สอดคล้องกัน มีความสำคัญเหนือกว่ากฎนี้
- การจองเป็นสิ่งที่เปลี่ยนแปลงได้ ไม่ใช่สิ่งตายตัว เซสชันที่มอบหมายให้นักบำบัดคนหนึ่งสามารถรับการเปลี่ยนแปลงได้ตลอดวงจรชีวิตของมัน — ตั้งแต่ตอนที่สร้างและยืนยัน จนกระทั่งบริการเสร็จสมบูรณ์ การเปลี่ยนแปลงเหล่านี้อาจส่งผลต่อ หรือเกิดจาก: การมอบหมายนักบำบัด การขยายระยะเวลา การเปลี่ยนวันและ/หรือเวลา การเพิ่มผู้ร่วม การยกเลิก ฯลฯ การเปลี่ยนแปลงในเซสชันหนึ่งอาจทำให้ต้องปรับเปลี่ยนเซสชันอื่นๆ เป็นผลตามมาด้วย

พนักงานต้อนรับควรคิดว่าการจองเป็นเหมือนตัวหมากที่เคลื่อนย้ายได้: สภาพแวดล้อมนำเสนอโอกาสในการจัดเรียงใหม่หรือแม้แต่ลบออกอยู่ตลอดเวลา เมื่อโอกาสเหล่านี้เกิดขึ้น พนักงานต้อนรับต้องประเมินว่าจะยอมรับหรือปฏิเสธการเปลี่ยนแปลง และหากยอมรับ ต้องกำหนดขอบเขตของมัน — ว่าจะส่งผลต่อเซสชันเดียวหรือรวมถึงเซสชันรอบข้างด้วย

เป้าหมายที่ใช้ตัดสินว่าควรทำการเปลี่ยนแปลงหรือไม่คือ:

1. ผลิตภาพและรายได้ของธุรกิจ
2. ความเท่าเทียมในการมอบหมายการจองให้นักบำบัด

การเปลี่ยนแปลงที่เพิ่มผลิตภาพและรายได้ของธุรกิจ โดยไม่กระทบต่อการมอบหมายนักบำบัดที่ลูกค้าร้องขอ หรือส่งผลเสียต่อความเท่าเทียมระหว่างนักบำบัด มีความเหมาะสมสูงที่จะดำเนินการ ในทางกลับกัน ผลลัพธ์เช่น การลดผลิตภาพหรือรายได้ของธุรกิจ การยกเลิกมอบหมายนักบำบัดที่ลูกค้าร้องขอโดยเฉพาะ หรือการต้องโทรหาลูกค้าเพื่อยืนยันวันหรือเวลาที่แตกต่างออกไป ทำให้การเปลี่ยนแปลงมีความเหมาะสมน้อยลง

นอกจากนี้ พนักงานต้อนรับยังต้องเป็นฝ่ายรุกเมื่อสถานการณ์เปลี่ยนแปลงระหว่างวัน (เช่น การยกเลิก) โดยปรับสมดุลการมอบหมายใหม่เพื่อรักษาความยุติธรรมและผลิตภาพ แทนที่จะปล่อยแผนเดิมไว้โดยไม่แก้ไข

## ตัวอย่าง:

- ตัวอย่างที่ 1: นักบำบัด A และ B ทำงานเมื่อวาน นักบำบัด C ไม่ได้ทำงานเมื่อวาน นักบำบัดทั้งสามคนทำงานไปแล้ว 3 ชั่วโมงวันนี้ การจองถัดไปมอบหมายให้นักบำบัด C ตามสิทธิ์วันหยุดก่อนหน้า
- ตัวอย่างที่ 2: เหมือนตัวอย่างที่ 1 แต่นักบำบัด C ทำงานไปแล้ว 4 ชั่วโมง มากกว่านักบำบัด A และ B อยู่ 1 ชั่วโมง การจองถัดไปมอบหมายให้นักบำบัด A หรือ B ตามสิทธิ์ความสมดุลชั่วโมงงานประจำวัน
- ตัวอย่างที่ 3: เหมือนตัวอย่างที่ 1 แต่ตอนนี้บ่าย 4 โมง และพนักงานต้อนรับรับโทรศัพท์จองคิวเวลา 6 โมงเย็น การจองมอบหมายให้นักบำบัด C ตามสิทธิ์วันหยุดก่อนหน้า 10 นาทีต่อมา พนักงานต้อนรับรับโทรศัพท์อีกสายหนึ่งจองคิวเวลา 5 โมงเย็น พนักงานต้อนรับย้ายการจอง 6 โมงเย็นให้นักบำบัด A หรือ B และมอบหมายการจอง 5 โมงเย็นให้นักบำบัด C ตามสิทธิ์วันหยุดก่อนหน้า
- ตัวอย่างที่ 4: เวลา 10:55 น. วันทำงานกำลังจะเริ่ม นักบำบัด A และ B ทำงานเมื่อวาน นักบำบัด C ไม่ได้ทำงานเมื่อวาน วันนี้มีการจองสองคิวเวลา 11:00 น. และหนึ่งคิวเวลา 11:30 น. โดยลูกค้าขอนักบำบัด C ถ้าเป็นไปได้ นักบำบัด C ได้รับมอบหมายการจองเวลา 11:30 น. ตามสิทธิ์การร้องขอของลูกค้า และนักบำบัด A และ B ได้รับการจองเวลา 11:00 น.
- ตัวอย่างที่ 5: นักบำบัด A และ B ทำงานไปแล้ว 3 ชั่วโมง และนักบำบัด C ทำงานไปแล้ว 5 ชั่วโมง (โดยมีพัก 30 นาทีตรงกลาง) ทุกคนทำงานเมื่อวาน ลูกค้า walk-in เข้ามาขอนักบำบัด C การจองมอบหมายให้นักบำบัด C ตามสิทธิ์การร้องขอของลูกค้า
- ตัวอย่างที่ 6: เหมือนตัวอย่างที่ 5 แต่นักบำบัด C เพิ่งทำนวดเสร็จจากการนวดติดต่อกัน 5 ชั่วโมง (ละเมิดกฎชั่วโมงสูงสุดติดต่อกัน) ลูกค้า walk-in ที่ขอนักบำบัด C ไม่สามารถรับบริการในเวลาอื่นได้และไม่ต้องการนักบำบัดคนอื่น ดังนั้นเราต้องตัดสินใจว่าจะรับหรือปฏิเสธ ตัวอย่างนี้ขึ้นอยู่กับหลายปัจจัย จึงไม่มีทางเลือก "ที่ดีที่สุด" สิ่งที่ถูกต้องคือถามชลิดาหรือฟรานพร้อมแนบรูปถ่ายตารางนัดหมาย สำหรับกรณีที่ซับซ้อนเช่นนี้ เราไม่เชื่อว่ากรณีเช่นนี้จะเกิดขึ้นบ่อย หากเกิดขึ้นบ่อย เราจะสร้างกฎเฉพาะเพื่อจัดการ
- ตัวอย่างที่ 7: นักบำบัด A มีนวดสองคิว: 11:00–12:00 และ 12:00–13:00 ลูกค้าของทั้งสองเซสชันไม่ได้ร้องขอนักบำบัด A โดยเฉพาะ ระหว่างการนวดคิวแรก ลูกค้าขอขยายเซสชันเพิ่มอีกหนึ่งชั่วโมง มีนักบำบัดคนอื่นว่างในช่วง 12:00 ถึง 13:00 พนักงานต้อนรับควรย้ายเซสชันที่สองของนักบำบัด A ให้นักบำบัดที่ว่าง และให้นักบำบัด A นวดต่อในเซสชันที่ขยายเวลา สองเซสชันได้รับผลกระทบ แต่การเปลี่ยนแปลงไม่มีข้อเสียใดๆ และเพิ่มผลิตภาพและรายได้ของธุรกิจ
- ตัวอย่างที่ 8: วันเริ่มต้นเวลา 11:00 น. มีนักบำบัดสองคนทำงานและมีการจอง 14 คิวมอบหมายเท่าเทียม (7 คิวให้นักบำบัด A, 7 คิวให้นักบำบัด B) ระหว่างวัน ลูกค้า 4 รายของนักบำบัด B ยกเลิกนัด พนักงานต้อนรับไม่ควรปล่อยให้วันนั้นจบลงด้วย 7 คิวสำหรับนักบำบัด A และ 3 คิวสำหรับนักบำบัด B พนักงานต้อนรับต้องเป็นฝ่ายรุกในการย้ายการจองที่เหมาะสมที่สุดเพื่อปรับสมดุลภาระงาน โดยพยายามเข้าใกล้สถานการณ์ที่เหมาะสมที่สุดคือ 5 เซสชันสำหรับนักบำบัดแต่ละคน

> **สรุป:** ลำดับความสำคัญของกฎคือ: 1. เวลาพักกินอาหารขั้นต่ำ-30-นาที, 2. การร้องขอของลูกค้า, 3. ความสมดุล, 4. วันหยุดก่อนหน้า, 5. ช่วงเวลากินอาหารที่แนะนำ
>
> กฎชั่วโมงสูงสุดติดต่อกันและชั่วโมงสูงสุด-7-ชั่วโมงต่อวันก็เป็นกฎที่สำคัญมากเช่นกัน ลำดับความสำคัญที่หนึ่งหรือสอง แต่เรายังไม่ชัดเจนว่ามีความสำคัญมากเพียงใดหากขัดแย้งกับกฎอื่นบางข้อ หากความขัดแย้งระหว่างกฎบางข้อเกิดขึ้นบ่อย จะมีการสร้างแนวทางปฏิบัติเพิ่มเติม

## หลักการปิดท้าย:

- กฎเหล่านี้ออกแบบมาเพื่อปกป้องทั้งความเป็นอยู่ที่ดีของนักบำบัดและการดำเนินงานของธุรกิจ การปฏิบัติตามกฎเหล่านี้มีความสำคัญเหนือกว่าความชอบส่วนบุคคลหรือคำขอเพื่อความสะดวกสบายที่อยู่นอกเหนือจากกฎเหล่านี้$gl$, created_at, updated_at
  FROM public.guidelines WHERE id = '5ac0f1d8-a6dd-4031-826f-9048293217d2';

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect 10 rows: the 6 Spanish-only guidelines with languages = 'es', the 4 trilingual ones with
-- languages = 'en, es, th'. Every row must have at least one language.
SELECT g.title AS current_title,
       string_agg(t.language, ', ' ORDER BY t.language) AS languages,
       string_agg(t.language || ': ' || coalesce(t.title, '—'), '  |  ' ORDER BY t.language) AS titles
  FROM public.guidelines g
  LEFT JOIN public.guideline_translations t ON t.guideline_id = g.id
 WHERE g.deleted_at IS NULL
 GROUP BY g.id, g.title, g.created_at
 ORDER BY g.created_at DESC;

-- Expect: translations = 18, rls_on = true, anon_can_read = false.
SELECT (SELECT count(*) FROM public.guideline_translations)                         AS translations,
       (SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.guideline_translations'::regclass)                     AS rls_on,
       has_table_privilege('anon', 'public.guideline_translations', 'SELECT')       AS anon_can_read;


-- ─────────────────────────────────────────────────────────────────────────────
-- UNDO (only if needed, before the app starts writing versions)
-- ─────────────────────────────────────────────────────────────────────────────
-- The original texts are still in guidelines.content, so undoing loses nothing written before
-- this migration.
-- BEGIN;
-- DROP TABLE public.guideline_translations;
-- ALTER TABLE public.guidelines ALTER COLUMN content SET NOT NULL;
-- COMMIT;
