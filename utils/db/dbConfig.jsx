// postgresql://zero2hero3_owner:npg_YvSBJf6A0wFh@ep-morning-night-a50cdem6-pooler.us-east-2.aws.neon.tech/zero2hero3?sslmode=require

import {neon} from '@neondatabase/serverless'
import {drizzle} from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(
    "postgresql://zerotohero_owner:npg_SIHNc9U5TbRt@ep-divine-smoke-a5lyxocr-pooler.us-east-2.aws.neon.tech/zero2hero?sslmode=require"
);
export const db = drizzle(sql, { schema });
