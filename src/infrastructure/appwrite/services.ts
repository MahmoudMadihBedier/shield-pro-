/**
 * Appwrite service singletons, all bound to the one shared `client`.
 *
 * `tablesDB` is the current Appwrite Databases API (tables + rows). Data-layer
 * repositories (modules/<name>/data) use these; presentation/domain never do.
 */
import { Account, Avatars, Functions, Storage, TablesDB, Teams } from 'appwrite'

import { client } from './client'

export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const storage = new Storage(client)
export const functions = new Functions(client)
export const teams = new Teams(client)
export const avatars = new Avatars(client)

export { client }
export { ID, Permission, Query, Role as AppwriteRole } from 'appwrite'
