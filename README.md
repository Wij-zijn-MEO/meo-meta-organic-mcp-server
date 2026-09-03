# meo-insights-mcp

Een **read-only** MCP-server voor MEO die **organische** Facebook- en Instagram-cijfers ophaalt uit de Meta Graph API. Bedoeld om de maandelijkse werkcentra-review volledig headless te draaien, zonder handmatige Business Suite-export.

Dit is een geharde fork van [`oliverames/meta-mcp-server`](https://github.com/oliverames/meta-mcp-server) (MIT). De originele server heeft ~200 tools inclusief publiceren, verwijderen, DM's, advertentiebeheer en commerce. **Deze fork kan niets muteren** — alleen lezen.

## Waarom een eigen fork

De upstream is van een onbekende auteur en vraagt om een breed System User token. In plaats van dat token blind aan alle 200 tools te geven, rust de veiligheid hier op **drie onafhankelijke lagen**:

1. **Read-only token** — de Meta System User krijgt alléén lees-scopes (zie hieronder). Zelfs een bug kan niets wijzigen.
2. **Verwijderde modules** — `ads`, `commerce`, `audiences`, `conversions`, `threads`, `ad_library` en `charts` staan niet meer in de broncode. Wat er niet is, kan niet lekken.
3. **Default-deny gate** ([`src/readonly.ts`](src/readonly.ts)) — elke tool-registratie wordt gecheckt tegen een expliciete allowlist én moet `readOnlyHint: true` dragen. Alles daarbuiten wordt geweigerd en op stderr gelogd.

Bewust **niet** opgenomen: alle DM-/inbox-/conversatie-leestools. Een geautomatiseerde maandreview hoeft nooit de inhoud van berichten van burgers te lezen.

## De 23 tools

**Facebook Pages (organic):** `meta_list_pages`, `meta_get_page`, `meta_get_posts`, `meta_get_published_posts`, `meta_get_post`, `meta_get_page_insights`, `meta_get_post_insights`, `meta_get_post_comments`, `meta_get_post_reactions`, `meta_get_page_fan_demographics`, `meta_get_page_videos`

**Instagram (organic):** `meta_list_instagram_accounts`, `meta_get_instagram_media`, `meta_get_instagram_single_media`, `meta_get_instagram_media_children`, `meta_get_instagram_media_insights`, `meta_get_instagram_account_insights`, `meta_get_instagram_comments`, `meta_get_instagram_comment_replies`, `meta_get_instagram_stories`, `meta_get_instagram_user`

**Diagnostiek:** `meta_debug_token`, `meta_health_check`

## Meta-setup (eenmalig)

1. **System User** aanmaken in Meta Business Manager → Bedrijfsinstellingen → Gebruikers → Systeemgebruikers.
2. **Pages toewijzen** aan die System User (Bedrijfsmiddelen → Pagina's → toegang toewijzen). Dit is de stap die iedereen vergeet — zonder toewijzing zie je niets.
3. **Instagram** koppelen: elk werkcentra-IG-account moet een *Instagram-businessaccount* zijn dat aan de bijbehorende Facebook-pagina hangt. De IG-cijfers lopen via dat gekoppelde account, niet via de page-id zelf.
4. **Token genereren** met alléén deze read-scopes:
   - `pages_read_engagement` — Facebook page/post insights
   - `read_insights` — organische insights-metrics
   - `instagram_basic` — IG-account + media lezen
   - `instagram_manage_insights` — IG-cijfers (verplicht voor IG!)
   - `ads_read` — optioneel, alleen als je later ad-context wilt
5. Controleer het token achteraf met `meta_debug_token` — daar zie je precies welke scopes erop zitten.

## MCP-client config

Voeg toe aan je Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meo-insights": {
      "command": "node",
      "args": ["/ABSOLUUT/PAD/NAAR/meo-insights-mcp/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "EAAG...het-systeem-user-token..."
      }
    }
  }
}
```

## Bouwen

```bash
npm install
npm run build   # compileert naar dist/
npm test        # incl. security-regressietest: write-tools mogen niet bestaan
```

Vereist Node.js ≥ 18.

## De maandreview-flow (voorbeeld: ZKIJ, page-id `103096542127554`)

1. `meta_list_pages` — laadt de pagina's + cachet de page-tokens.
2. `meta_list_instagram_accounts` — geeft per pagina het gekoppelde IG-businessaccount-ID. Zoek ZKIJ, pak `instagram_business_account.id`.
3. **Facebook:** `meta_get_posts` (page-id) → per post `meta_get_post_insights`.
4. **Instagram:** `meta_get_instagram_media` (IG-account-ID) → per media `meta_get_instagram_media_insights`.

Voor álle werkcentra-pagina's herhaal je stap 2–4; ZKIJ is puur de eerste test. Alles read-only, dus veilig om ongeattendeerd te draaien.

### Metric-mapping

| Wens | Facebook (post insights) | Instagram (media insights) |
|---|---|---|
| Bereik | `post_impressions_unique` | `reach` |
| Impressies | `post_impressions` | `views` (Meta heeft `impressions` in 2025 uitgefaseerd voor IG) |
| Likes/reacties | `post_reactions_by_type_total` | `likes`, `comments` |
| Shares | via post-object | `shares` |
| Saves | n.v.t. | `saved` |

**Reels vs feed vs stories** ondersteunen verschillende metrics, en Meta verschuift die matrix. `meta_get_instagram_media_insights` is daarom veerkrachtig gemaakt: vraag je een metric op die voor dát media-type niet bestaat, dan laat de tool die metric vallen en levert de rest, met een notitie welke zijn overgeslagen — één incompatibele metric op één post laat een headless run dus nooit klappen.

## Licentie & attributie

MIT — zie [LICENSE](LICENSE). Gebaseerd op `meta-mcp-server` van Oliver Ames; de read-only harding, modulesnoei en IG-insights-veerkracht zijn toegevoegd voor MEO.
