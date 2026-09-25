-- Social/Threads drafts quoting the old Базовий price (79 грн → 129 грн).
-- Backup: docs/backup/social-drafts-2026-09-25-before-reprice.json
-- Each UPDATE runs only if the row is byte-identical to the backup (md5 guard).
-- Apply AFTER the pricing PR is merged and deployed.
begin;
update public.social_posts set caption = replace(caption, '100 ГБ за 79 грн', '100 ГБ за 129 грн'), updated_at = now()
 where id = '23fb3b38-1afb-472c-94e7-a0e3ffc30f99' and md5(to_jsonb(social_posts)::text) = '117d9457a2939d4d74c0253bcac01115';
update public.social_posts set caption = replace(caption, '100 ГБ за 79 грн', '100 ГБ за 129 грн'), updated_at = now()
 where id = 'c2f208f9-77bf-4651-9227-f87af2df017e' and md5(to_jsonb(social_posts)::text) = '7a625e677150292bae6722b066589be1';
update public.social_topics set title = replace(title, '79 грн за 100 ГБ', '129 грн за 100 ГБ')
 where id = 'e3ce9814-6b22-40cd-8f5d-d5250bb98657' and md5(to_jsonb(social_topics)::text) = '7b01de7609fc890324d93c5e26dce2dc';
update public.threads_replies set draft_reply = replace(draft_reply, '100 ГБ / 79 грн', '100 ГБ / 129 грн'), updated_at = now()
 where id = '2918a666-5ee0-4c19-8f30-b596ae8316a5' and md5(to_jsonb(threads_replies)::text) = 'ed81abfec04323418184b93e826decf7';
update public.threads_replies set draft_reply = replace(draft_reply, '100 ГБ за 79 грн', '100 ГБ за 129 грн'), updated_at = now()
 where id = '2f78fcd2-51dd-4a3d-9b22-83f59592eadb' and md5(to_jsonb(threads_replies)::text) = 'aeb812000d393d6b930023ac2f7a4e50';
commit;
