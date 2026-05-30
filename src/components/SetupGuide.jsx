import { Database, Key, Globe, FileCode, CheckCircle } from 'lucide-react';

export default function SetupGuide() {
  return (
    <div className="fade-in">
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Setup Guide</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          Follow these steps to connect the app to your Supabase database.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Step
            number={1}
            icon={Globe}
            title="Create a Supabase account"
            desc={
              <>
                Go to{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline' }}
                >
                  supabase.com
                </a>{' '}
                and sign up for a free account (no credit card required).
              </>
            }
          />

          <Step
            number={2}
            icon={Database}
            title="Create a new project"
            desc="In your Supabase dashboard, click 'New project'. Give it a name (e.g., 'egg-monitoring') and choose a strong database password. Wait for the database to be provisioned (~2 minutes)."
          />

          <Step
            number={3}
            icon={FileCode}
            title="Run the database schema"
            desc={
              <>
                In your Supabase project, go to the{' '}
                <strong>SQL Editor</strong> tab. Open the{' '}
                <code style={{ background: 'var(--color-primary-light)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8125rem' }}>
                  database_schema.sql
                </code>{' '}
                file from this project, copy the contents, paste them into the SQL Editor, and click{' '}
                <strong>'Run'</strong>.
              </>
            }
          />

          <Step
            number={4}
            icon={Key}
            title="Get your API credentials"
            desc={
              <>
                In your Supabase project settings, go to{' '}
                <strong>Project Settings &gt; API</strong>. Copy the{' '}
                <strong>'Project URL'</strong> and the{' '}
                <strong>'anon public key'</strong>.
              </>
            }
          />

          <Step
            number={5}
            icon={FileCode}
            title="Create your .env file"
            desc={
              <>
                Create a file named <strong>.env</strong> in the project root
                folder with the following content:
                <pre
                  style={{
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    marginTop: '0.75rem',
                    overflowX: 'auto',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
                </pre>
                Replace the values with what you copied from Supabase.
              </>
            }
          />

          <Step
            number={6}
            icon={CheckCircle}
            title="Restart the app"
            desc="After saving the .env file, stop the dev server (Ctrl+C) and run `npm run dev` again. The app will now be connected to your database!"
          />
        </div>

        <div
          className="card"
          style={{
            marginTop: '2rem',
            background: 'var(--color-success-bg)',
            borderColor: '#A5D6A7',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 500, fontSize: '0.9375rem' }}>
            Once connected, the app will automatically create inventory records for all 7 egg sizes.
            Start by adding your stock levels in the{' '}
            <strong>Inventory</strong> page, then record sales in the{' '}
            <strong>Sales Log</strong>.
          </p>
        </div>
      </div>

      <style>{`
        .setup-step {
          display: flex;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.2s;
        }

        .setup-step:hover {
          box-shadow: var(--shadow-md);
        }

        .step-number {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--color-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .step-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--color-primary-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .step-content h3 {
          margin-bottom: 0.375rem;
          font-size: 1rem;
        }

        .step-content p {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          line-height: 1.6;
        }

        code {
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}

function Step({ number, icon: Icon, title, desc }) {
  return (
    <div className="setup-step">
      <div className="step-number">{number}</div>
      <div className="step-content">
        <h3>
          <Icon
            size={16}
            style={{ marginRight: '0.375rem', verticalAlign: 'middle' }}
          />
          {title}
        </h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}
