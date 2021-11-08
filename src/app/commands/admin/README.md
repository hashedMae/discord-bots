#GuestPass
---

Command for assigning a guest pass to a user. 

Extension of SlashCommand

Imports
- [roleIds]('../../../service/constants/constants.ts) Roles within Discord Server that are a constant.
- [addGuestRoleToUser]('../../../service/guest-pass/AddGuestPass.ts#L54) Function that handles logic of adding a Guest Pass.
- [discordServerIds]('../../../service/constants/discordServerIds.ts) Server IDs used in bDAO for production and development.

Restricts users that can add a guest pass to 
- Level 2
- Level 3
- Level 4
- Genesis Squad
- Admin
