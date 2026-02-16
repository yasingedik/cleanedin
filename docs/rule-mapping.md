# Rule Mapping (Initial)

| Category | Primary Evidence | Fallback Evidence |
| --- | --- | --- |
| ad | `data-sponsored-update`, ad test IDs | `sponsored` text |
| promoted | ad control attributes/test IDs | `promoted` text |
| recommended | recommendation test/view IDs | `recommended`/`suggested` text |
| liked | activity-like attributes | `liked`/`reacted` text |
| commented | activity-comment attributes | `commented` text |
| followed | activity-follow attributes | `followed`/`following` text |
| shared | reshare attrs and URLs | `reposted`/`shared` text |
| video | `<video>`, video embeds | none |
| poll | poll test IDs/progressbars | none |
| image | large image elements | none |
| link | external links | none |
| carousel | carousel/document indicators | none |
