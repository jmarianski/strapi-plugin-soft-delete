import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import { Main, Box, Typography, Button, Flex } from '@strapi/design-system';
import { ArrowClockwise, Trash } from '@strapi/icons';
import { PLUGIN_ID } from '../pluginId';
import { format } from 'date-fns';

interface SoftDeletedEntry {
  id: number;
  documentId?: string;
  publishedAt?: string;
  status?: string;
  [key: string]: any; // This will include the soft delete fields dynamically
}

interface GroupedEntry {
  documentId: string;
  versions: SoftDeletedEntry[];
  [key: string]: any; // This will include the _softDeletedAt field for sorting
}

export const ContentTypeEntries = () => {
  const { uid } = useParams<{ uid: string }>();
  const [entries, setEntries] = useState<SoftDeletedEntry[] | GroupedEntry[]>([]);
  const [isGrouped, setIsGrouped] = useState(false);
  const [loading, setLoading] = useState(true);
  const { get, put, del } = useFetchClient();

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_ID}/content-types/${uid}/entries`);
      setEntries(data.entries || []);
      setIsGrouped(data.grouped || false);
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

  const handleRestore = async (entryId: number | string) => {
    try {
      const response = await put(`/${PLUGIN_ID}/content-types/${uid}/entries/${entryId}/restore`);

      // Show success message
      console.log('Entry restored successfully:', response.data);

      fetchEntries();
    } catch (error) {
      console.error('Failed to restore entry:', error);
    }
  };

  const handleDeletePermanently = async (entryId: number | string) => {
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

  const renderGroupedEntry = (groupedEntry: GroupedEntry) => (
    <Box
      key={groupedEntry.documentId}
      padding={4}
      background="neutral100"
      borderRadius="4px"
      marginBottom={3}
    >
      <Flex justifyContent="space-between" alignItems="center" gap={2}>
        <Flex gap={2}>
          <Typography variant="beta">Document ID: {groupedEntry.documentId}</Typography>
          <Typography variant="epsilon" textColor="neutral600">
            Versions: {groupedEntry.versions.map((v) => v.status).join(', ')}
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            Deleted: {format(new Date(groupedEntry['_softDeletedAt']), 'PPpp')}
          </Typography>
          {groupedEntry.versions.map((version, index) => (
            <Typography key={index} variant="pi" textColor="neutral500">
              {version.status}: ID {version.id}
            </Typography>
          ))}
        </Flex>
        <Flex gap={2}>
          <Button
            size="S"
            startIcon={<ArrowClockwise />}
            variant="secondary"
            onClick={() => handleRestore(groupedEntry.documentId)}
            title="Restore all versions of this document"
          >
            Restore All
          </Button>
          <Button
            size="S"
            startIcon={<Trash />}
            variant="danger-light"
            onClick={() => handleDeletePermanently(groupedEntry.documentId)}
          >
            Delete Permanently
          </Button>
        </Flex>
      </Flex>
    </Box>
  );

  const renderSingleEntry = (entry: SoftDeletedEntry) => (
    <Box key={entry.id} padding={4} background="neutral100" borderRadius="4px" marginBottom={3}>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex gap={2}>
          <Typography variant="beta">
            ID: {entry.id}
            {entry.documentId && entry.documentId !== String(entry.id) && (
              <Typography variant="pi" textColor="neutral500">
                {' '}
                (Document: {entry.documentId})
              </Typography>
            )}
          </Typography>
          {entry.publishedAt && (
            <Typography variant="pi" textColor="primary600">
              Published Content
            </Typography>
          )}
          <Typography variant="epsilon" textColor="neutral600">
            Deleted: {entry['_softDeletedAt'] ? format(new Date(entry['_softDeletedAt']), 'PPpp') : ''}
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            By: {entry._softDeletedByType}
          </Typography>
        </Flex>
        <Flex gap={2}>
          <Button
            size="S"
            startIcon={<ArrowClockwise />}
            variant="secondary"
            onClick={() => handleRestore(entry.id)}
            title="Restore this entry"
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
  );

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
        <Typography variant="alpha">
          Soft Deleted Entries - {uid}
          {isGrouped && (
            <Typography variant="epsilon" textColor="neutral600">
              {' '}
              (Grouped by Document)
            </Typography>
          )}
        </Typography>

        <Box paddingTop={6}>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : entries.length === 0 ? (
            <Typography>No soft deleted entries found.</Typography>
          ) : (
            <Box>
              {isGrouped
                ? // Render grouped entries (draft/publish content types)
                  (entries as GroupedEntry[]).map((groupedEntry) =>
                    renderGroupedEntry(groupedEntry)
                  )
                : // Render individual entries (non-draft/publish content types)
                  (entries as SoftDeletedEntry[]).map((entry) => renderSingleEntry(entry))}
            </Box>
          )}
        </Box>
      </Box>
    </Main>
  );
};
