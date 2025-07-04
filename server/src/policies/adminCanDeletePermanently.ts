import { pluginId } from '../utils/plugin';

export default (policyContext, config, { strapi }) => {
  console.log('!!!!!!!!!!!! adminCanDeletePermanently policy executed', {
    pluginId,
    params: policyContext.params,
    user: policyContext.state.user?.id,
    userAbility: !!policyContext.state.userAbility,
  });

  const { userAbility } = policyContext.state;
  const canDelete = userAbility.can(
    `plugin::${pluginId}.explorer.delete-permanently`,
    policyContext.params.uid
  );

  console.log('!!!!!!!!!!!! adminCanDeletePermanently permission check result:', canDelete);

  return canDelete;
};
