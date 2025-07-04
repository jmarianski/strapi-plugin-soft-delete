import { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Main, Box, Typography, Button, Grid, Radio } from '@strapi/design-system';
import { Check } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';

interface Settings {
  singleTypesRestorationBehavior: 'soft-delete' | 'delete-permanently';
  draftPublishRestorationBehavior: 'draft' | 'unchanged';
}

export const RestorationBehavior = () => {
  const { formatMessage } = useIntl();
  const [settings, setSettings] = useState<Settings>({
    singleTypesRestorationBehavior: 'soft-delete',
    draftPublishRestorationBehavior: 'unchanged',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { get, put } = useFetchClient();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/settings`);
        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await put(`/${PLUGIN_ID}/settings`, settings);
      // Show success notification
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Typography>Loading...</Typography>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha">
          {formatMessage({
            id: getTranslation('settings.restoration-behavior.title'),
            defaultMessage: 'Restoration Behavior',
          })}
        </Typography>
        <Typography variant="epsilon" textColor="neutral600">
          Configure how entries are restored from soft delete
        </Typography>

        <Box paddingTop={6}>
          <Grid.Root gap={6}>
            <Grid.Item col={6} s={12}>
              <Box>
                Single Types Restoration Behavior
                <Box paddingTop={2}>
                  <Radio.Group
                    value={settings.singleTypesRestorationBehavior}
                    onValueChange={(value: string) =>
                      setSettings((prev) => ({
                        ...prev,
                        singleTypesRestorationBehavior: value as
                          | 'soft-delete'
                          | 'delete-permanently',
                      }))
                    }
                  >
                    <Radio.Item value="soft-delete">Soft Delete existing entry</Radio.Item>
                    <Radio.Item value="delete-permanently">
                      Delete permanently existing entry
                    </Radio.Item>
                  </Radio.Group>
                </Box>
              </Box>
            </Grid.Item>

            <Grid.Item col={6} s={12}>
              <Box>
                Draft & Publish Restoration Behavior
                <Box paddingTop={2}>
                  <Radio.Group
                    value={settings.draftPublishRestorationBehavior}
                    onValueChange={(value: string) =>
                      setSettings((prev) => ({
                        ...prev,
                        draftPublishRestorationBehavior: value as 'draft' | 'unchanged',
                      }))
                    }
                  >
                    <Radio.Item value="draft">Restore as draft</Radio.Item>
                    <Radio.Item value="unchanged">
                      Restore unchanged (preserve published state)
                    </Radio.Item>
                  </Radio.Group>
                </Box>
              </Box>
            </Grid.Item>
          </Grid.Root>

          <Box paddingTop={6}>
            <Button onClick={handleSave} loading={saving} startIcon={<Check />}>
              Save Settings
            </Button>
          </Box>
        </Box>
      </Box>
    </Main>
  );
};
