import { DATABASE } from './database'
import { SITE_CONFIG } from './site'
import { ROUTES } from './constants' 

export const CONFIG = {
    DB: DATABASE, 
    SITE: SITE_CONFIG, 
    ROUTES: ROUTES,
}

export * from './database'
export * from './site'
export * from './constants'