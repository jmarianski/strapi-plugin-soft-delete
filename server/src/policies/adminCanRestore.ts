import { pluginId } from '../utils/plugin';

export default async (policyContext, config, { strapi }) => {
  console.log('!!!!!!!!!!!! adminCanRestore policy executed', {
    pluginId,
    params: policyContext.params,
    user: policyContext.state.user?.id,
    userAbility: !!policyContext.state.userAbility,
    method: policyContext.request?.method,
    path: policyContext.request?.path,
  });

  const { userAbility } = policyContext.state;

  if (!userAbility) {
    console.log('!!!!!!!!!!!! No userAbility found in policy context');
    return false;
  }

  const canRestore = userAbility.can(
    `plugin::${pluginId}.explorer.restore`,
    policyContext.params.uid
  );

  console.log('!!!!!!!!!!!! adminCanRestore permission check result:', canRestore);

  return canRestore;
};
