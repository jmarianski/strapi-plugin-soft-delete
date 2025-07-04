import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Soft Delete',
      },
      Component: async () => {
        const { App } = await import('./pages/App');

        return App;
      },
      permissions: [
        {
          action: `plugin::${PLUGIN_ID}.read`,
          subject: null,
        },
      ],
    });

    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: {
          id: getTranslation('plugin.name'),
          defaultMessage: 'Soft Delete',
        },
      },
      [
        {
          intlLabel: {
            id: getTranslation('settings.restoration-behavior.title'),
            defaultMessage: 'Restoration Behavior',
          },
          id: `${PLUGIN_ID}.settings.restoration-behavior`,
          to: `/settings/${PLUGIN_ID}/restoration-behavior`,
          Component: async () => {
            const { RestorationBehavior } = await import('./pages/RestorationBehavior');
            return RestorationBehavior;
          },
          permissions: [
            {
              action: `plugin::${PLUGIN_ID}.settings`,
              subject: null,
            },
          ],
        },
      ]
    );

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
