import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';

import { HomePage } from './HomePage';
import { ContentTypeEntries } from './ContentTypeEntries';

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="content-types/:uid" element={<ContentTypeEntries />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export { App };
