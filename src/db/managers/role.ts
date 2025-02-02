import { User } from "discord.js";

import { InteractionHandler } from "../../interaction/handler.js";
import { ClientDatabaseManager } from "../cluster.js";
import { Command } from "../../command/command.js";
import { BotStatus } from "../../bot/bot.js";
import { DatabaseUser } from "./user.js";

export type UserRole = "tester" | "investor" | "advertiser" | "moderator" | "owner"
export type UserRoles = UserRole[]

export const UserRoleHierarchy: UserRoles = [
    "owner", "moderator", "investor", "advertiser", "tester"
]

interface UserRoleChanges {
    /* Roles to add */ 
    add?: UserRoles;

    /* Roles to remove */
    remove?: UserRoles;
}

enum UserHasRoleCheck {
    /* The user must have all specified roles */
    All,

    /* The user must have one of the specified roels */
    Some,

    /* The user must not have all the specified */
    NotAll,

    /* The user must not have some of the roles */
    NotSome
}

export class UserRoleManager {
    /* The database manager itself */
    private readonly db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
        this.db = db;
    }

    public template(user: User): UserRoles {
        if (this.db.bot.app.config.discord.owner.includes(user.id)) return [ "tester", "investor", "advertiser", "moderator", "owner" ];
        else return [];
    }

    public roles(user: DatabaseUser): UserRoles {
        return user.roles;
    }

    public has(user: DatabaseUser, role: UserRole | UserRole[], check: UserHasRoleCheck = UserHasRoleCheck.All): boolean {
        if (Array.isArray(role)) {
            if (check === UserHasRoleCheck.All) return role.every(r => user.roles.includes(r));
            else if (check === UserHasRoleCheck.Some) return role.some(r => user.roles.includes(r));
            else if (check === UserHasRoleCheck.NotAll) return role.every(r => !user.roles.includes(r));
            else if (check === UserHasRoleCheck.NotSome) return role.some(r => !user.roles.includes(r));

            return false;
        } else return user.roles.includes(role);
    }

    public canExecuteCommand(user: DatabaseUser, command: Command | InteractionHandler, status?: BotStatus): boolean {
        if (command.options.restriction.length === 0) return status ? status.type !== "maintenance" : true;
        if (this.owner(user)) return true;

        if (command.premiumOnly()) {
            if (command.premiumOnly()) return this.db.users.type({ user }).premium;
            else if (command.subscriptionOnly()) return this.db.users.type({ user }).type === "subscription";
            else if (command.planOnly()) return this.db.users.type({ user }).type === "plan";
        }

        return this.has(user, command.options.restriction as UserRole[], UserHasRoleCheck.Some);
    }

    /* Shortcuts */
    public moderator(user: DatabaseUser): boolean { return this.has(user, "moderator"); }
    public tester(user: DatabaseUser): boolean { return this.has(user, "tester"); }
    public owner(user: DatabaseUser): boolean { return this.has(user, "owner"); }
    public investor(user: DatabaseUser): boolean { return this.has(user, "investor"); }
    public advertiser(user: DatabaseUser): boolean { return this.has(user, "advertiser"); }

    public async toggle(user: DatabaseUser, role: UserRole, status?: boolean): Promise<DatabaseUser> {
        return await this.change(user, {
            [status ?? !this.has(user, role) ? "add" : "remove"]: [ "tester" ]
        });
    }

    public async change(user: DatabaseUser, changes: UserRoleChanges): Promise<DatabaseUser> {
        /* Current roles */
        let updated: UserRoles = user.roles;

        if (changes.remove) updated = updated.filter(r => !changes.remove!.includes(r));
        if (changes.add) updated.push(...changes.add.filter(r => !updated.includes(r)));

        return this.db.users.updateUser(user, {
            roles: updated
        });
    }
}