import CrudPage from '../../components/CrudPage.jsx';

export default function CertificateTypes() {
  return (
    <CrudPage
      title="Certificate Types" singular="Certificate type" endpoint="/types" idKey="type_id"
      fields={[
        { key: 'type_name', label: 'Type name', required: true, full: true },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      columns={[
        { key: 'type_id', label: 'ID' },
        { key: 'type_name', label: 'Type name' },
        { key: 'description', label: 'Description' },
      ]}
    />
  );
}
