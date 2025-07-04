import { pluginId } from '../utils/plugin';

export default (policyContext, config, { strapi }) => {
  const { userAbility } = policyContext.state;
  console.log(
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!11adminCanDeletePermanently policy context:',
    policyContext
  );
  return userAbility.can(`plugin::${pluginId}.explorer.read`, policyContext.params.uid);
};
