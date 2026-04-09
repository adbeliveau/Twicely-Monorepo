# RBAC Vocabulary Lock (Authoritative)

**Version:** 1.1  
**Updated:** 2026-01-24

## Allowed Corp Authorization
- PlatformRole.ADMIN
- PlatformRole.DEVELOPER
- PlatformRole.FINANCE
- PlatformRole.MODERATION
- PlatformRole.SUPPORT
- PlatformRole.SRE (optional, for dedicated SRE staff - defaults to DEVELOPER if not implemented)

## Allowed Seller Authorization
- Seller delegated scopes only (see TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md)

## Forbidden (Never Use)
- settings.*
- flags.*
- catalog.*
- trust.*
- analytics.*
- Any invented permission string

If a permission is not listed above, it MUST NOT be introduced.
