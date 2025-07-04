import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import { Main, Box, Typography, Button, Flex } from '@strapi/design-system';
import { ArrowClockwise, Trash } from '@strapi/icons';
import { PLUGIN_ID } from '../pluginId';
import { format } from 'date-fns';

interface Entry {
  id: number;
  [key: string]: any;
  _softDeletedAt: string;
  _softDeletedById: number;
  _softDeletedByType: string;
}

export const ContentTypeEntries = () => {
  const { uid } = useParams<{ uid: string }>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { get, put, del } = useFetchClient();

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_ID}/content-types/${uid}/entries`);
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchEntries();
    }
  }, [uid]);

  const handleRestore = async (entryId: number) => {
    try {
      await put(`/${PLUGIN_ID}/content-types/${uid}/entries/${entryId}/restore`);
      fetchEntries();
    } catch (error) {
      console.error('Failed to restore entry:', error);
    }
  };

  const handleDeletePermanently = async (entryId: number) => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete this entry? This action cannot be undone.'
      )
    ) {
      try {
        await del(`/${PLUGIN_ID}/content-types/${uid}/entries/${entryId}`);
        fetchEntries();
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  };

  if (!uid) {
    return (
      <Main>
        <Box padding={8}>
          <Typography>Invalid content type</Typography>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha">Soft Deleted Entries - {uid}</Typography>

        <Box paddingTop={6}>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : entries.length === 0 ? (
            <Typography>No soft deleted entries found.</Typography>
          ) : (
            <Box>
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  padding={4}
                  background="neutral100"
                  borderRadius="4px"
                  marginBottom={3}
                >
                  <Flex justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="beta">ID: {entry.id}</Typography>
                      <Typography variant="epsilon" textColor="neutral600">
                        Deleted:{' '}
                        {entry._softDeletedAt ? format(new Date(entry._softDeletedAt), 'PPpp') : ''}
                      </Typography>
                      <Typography variant="epsilon" textColor="neutral600">
                        By: {entry._softDeletedByType}
                      </Typography>
                    </Box>
                    <Flex gap={2}>
                      <Button
                        size="S"
                        startIcon={<ArrowClockwise />}
                        variant="secondary"
                        onClick={() => handleRestore(entry.id)}
                      >
                        Restore
                      </Button>
                      <Button
                        size="S"
                        startIcon={<Trash />}
                        variant="danger-light"
                        onClick={() => handleDeletePermanently(entry.id)}
                      >
                        Delete Permanently
                      </Button>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Main>
  );
};
