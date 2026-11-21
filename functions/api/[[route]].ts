import { createD1Db } from '../../server/db'
import { handleApi } from '../../server/app'

interface PagesContext {
  request: Request
  env: { DB: unknown; ADMIN_CODE?: string }
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const db = createD1Db(context.env.DB)
  return await handleApi(context.request, {
    db,
    adminCode: context.env.ADMIN_CODE ?? '',
  })
}
