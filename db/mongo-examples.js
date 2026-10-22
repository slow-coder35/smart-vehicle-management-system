// mongosh, connected to the motive database with an authorized account.
// A real booking must exist in PostgreSQL before the application writes an inspection.
db.job_inspections.getIndexes();
db.getCollectionInfos({ name: 'job_inspections' })[0].options.validator;
db.job_inspections.aggregate([
  { $unwind: '$items' },
  { $match: { 'items.result': 'FAIL' } },
  { $group: { _id: '$items.component', failedChecks: { $sum: 1 } } },
  { $sort: { failedChecks: -1 } }
]);
// Staff-scoped production aggregation adds centre_id and optional updated_at filters first.
