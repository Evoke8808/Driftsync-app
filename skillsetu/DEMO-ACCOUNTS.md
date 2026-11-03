# Demo sign-in accounts (local test only)

These accounts are created automatically every time you run `cds deploy`
(from db/data/skillsetu-Accounts.csv), so a rebuild no longer wipes them.

| Portal | Username | Password |
|---|---|---|
| Job seeker sign-in (`#/login`) | `demo` | `skillsetu123` |
| Counsellor sign-in (`#/counsellor-login`) | `meera.ccp` | `skillsetu123` |

To rebuild the database from scratch (clears all cases and chats):

    npx cds deploy --to sqlite:db.sqlite
