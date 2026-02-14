import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function PrivacyPolicyPage() {
  const nav = useNavigate();
  const [ack, setAck] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">
              Privacy Policy
            </div>
            <div className="text-xs text-gray-500">
              Testing build · Group member based
            </div>
          </div>
          <Button variant="ghost" onClick={() => nav(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              This page is designed for testing only. The app is group member
              based and access is via creating a group or joining with an invite
              code.
            </p>
            <p>
              We do not intentionally collect personal data beyond basic account
              details required to login. Group content (posts, images) is stored
              only to support the app features.
            </p>
            <p>
              Cookies and local storage may be used for session handling and
              preferences. By using this app, you acknowledge this usage.
            </p>
            <p className="text-xs text-gray-500">
              This policy may change at any time during testing.
            </p>
          </div>

          <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>I understand and acknowledge this privacy policy.</span>
          </label>
        </Card>
      </div>
    </div>
  );
}
