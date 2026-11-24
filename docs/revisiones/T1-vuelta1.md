# Revisión T1 - vuelta 1

**Resultado global: APROBADO**

Revisión de lectura del SQL (`supabase/migrations/0001_init.sql`, `supabase/seed.sql`). No hay Postgres local, así que no se pudo ejecutar el SQL; la prueba contra la BD real es T3. `npm test` y `npm run test:e2e` no existen aún (llegan en T2): no se cuentan como fallo.

| Directriz / criterio | Resultado | Evidencia |
|---|---|---|
| 1 lint | Cumple | `npm run lint` sin salida de error |
| 2 tsc | Cumple | `npx tsc --noEmit` sin errores |
| 3 build | Cumple | `npm run build` correcto |
| 5 dinero en céntimos / crit. 3 | Cumple | `grep -niE "numeric|float|real|double|decimal|money"` sobre el SQL: sin coincidencias; todo `integer` |
| 8 migraciones | Cumple | `git status`: solo `?? supabase/`; sin cambios en migraciones existentes |
| 13 RLS / crit. 1 | Cumple | 8 `create table`, 8 `enable row level security`, 19 `create policy`; cada tabla tiene al menos una política |
| 14 aislamiento por taller | Cumple (lectura) | todas las políticas usan `workshop_id = current_workshop_id()`; FKs compuestas (id, workshop_id) impiden mezclar talleres. Prueba real en T3 |
| 16 vista pública | N/A en T1 | sin acceso anon; ninguna política para anon |
| 18 secretos / crit. 8 | Cumple | git grep sin coincidencias reales (el `eyJ` es un hash de package-lock.json); emails solo `demo@example.com` y `demo2@example.com` |
| 19 / crit. 2 service_role | Cumple | ausente en `supabase/`; solo aparece en documentos que lo prohíben. Políticas solo `to authenticated` |
| 20 .env | Cumple | `git ls-files \| grep -i "^\.env"` vacío; no se leyó ningún .env |
| 34 / crit. 4 índices | Cumple | todos los pedidos presentes; `unique(workshop_id, plate_norm)` como constraint |
| Crit. 5 order_lines | Cumple | `revoke update` + `grant update (kind, description, qty_milli, unit_price_cents, "position")`; `revoke insert` + `grant insert (order_id, workshop_id, kind, description, qty_milli, unit_price_cents, "position")`; sin decision/decided_at; políticas update/delete exigen `decision = 'pendiente'` |
| Crit. 6 order_events | Cumple | solo política select; solo grant select |
| Crit. 7 seed | Cumple | 2 talleres, 2 usuarios enlazados por email con error claro, órdenes 1-10 cubren los 6 estados, taller 2 con `9999 ZZZ`, sin enlaces públicos |
| Crit. 9 | Cumple | revisión de lectura |
| Coherencia SQL | Cumple | orden: normalize_plate, tablas, índices, current_workshop_id, políticas, triggers, create_order; `search_path=''` con nombres calificados; seed re-ejecutable (borra y recrea con ids fijos, temp table se elimina) |

## Observaciones menores (no bloqueantes)
- Las políticas se llaman `public_links_*` (nombre de tabla), no mencionan el rol public.
- `public_links` permite insert/update directo a authenticated; en T10 conviene restringir columnas/validar el hash.
