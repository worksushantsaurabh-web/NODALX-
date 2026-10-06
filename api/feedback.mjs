import {accountHandler} from '../server/supabase-account.mjs';

export default (request, response) => accountHandler(request, response, 'feedback');
