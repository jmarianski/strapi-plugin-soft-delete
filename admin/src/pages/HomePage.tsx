import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import { Main, Box, Typography, LinkButton, Grid } from '@strapi/design-system';
import { Folder } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';

interface ContentType {
  uid: string;
  displayName: string;
  pluralName: string;
}

const HomePage = () => {
  const { formatMessage } = useIntl();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const { get } = useFetchClient();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContentTypes = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/content-types`);
        setContentTypes(data.contentTypes || []);
      } catch (error) {
        console.error('Failed to fetch content types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContentTypes();
  }, []);

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
          {formatMessage({ id: getTranslation('plugin.name'), defaultMessage: 'Soft Delete' })}
        </Typography>
        <Typography variant="epsilon" textColor="neutral600">
          View and manage soft deleted entries
        </Typography>

        <Box paddingTop={6}>
          <Grid.Root gap={4}>
            {contentTypes.map((contentType) => (
              <Grid.Item key={contentType.uid} col={6} s={12}>
                <LinkButton
                  href={`/admin/plugins/${PLUGIN_ID}/content-types/${contentType.uid}`}
                  variant="secondary"
                  startIcon={<Folder />}
                  fullWidth
                >
                  {contentType.displayName}
                </LinkButton>
              </Grid.Item>
            ))}
          </Grid.Root>
        </Box>
      </Box>
    </Main>
  );
};

export { HomePage };
