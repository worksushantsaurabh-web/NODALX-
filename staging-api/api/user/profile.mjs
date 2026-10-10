import {accountHandler} from '../../../server/supabase-account.mjs';
import {applyApiCors} from '../../../server/api-cors.mjs';

export default (request, response) => {
  const cors = applyApiCors(request, response);
  if (cors) return cors;
  return accountHandler(request, response, 'profile');
};
