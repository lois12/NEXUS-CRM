import { register } from '../migrator';
import { run } from '../database';

// Additive only — public form consent proof (152-FZ)
register('024', 'consent_log', () => {
  run('ALTER TABLE survey_responses ADD COLUMN consent INTEGER DEFAULT 0', [], true);
  run('ALTER TABLE survey_responses ADD COLUMN consentAt TEXT', [], true);
  run('ALTER TABLE survey_responses ADD COLUMN consentIp TEXT', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN consent INTEGER DEFAULT 0', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN consentAt TEXT', [], true);
  run('ALTER TABLE registration_submissions ADD COLUMN consentIp TEXT', [], true);
});
