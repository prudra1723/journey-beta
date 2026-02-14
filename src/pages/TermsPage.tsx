import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function TermsPage() {
  const nav = useNavigate();
  const [ack, setAck] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">
              Terms & Conditions
            </div>
            <div className="text-xs text-gray-500">
              Testing build · Non-commercial use
            </div>
          </div>
          <Button variant="ghost" onClick={() => nav(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              This app is for fun trip planning and group coordination. Terms
              can change anytime.
            </p>
            <p>
              Use this app at your own risk. No hacking, abuse, or security
              testing is allowed.
            </p>
            <p>
              No commercial use. Do not copy, sell, or resell this app or its
              content.
            </p>
            <p>
              This app is group member based; access is via creating a group or
              joining with an invite code.
            </p>
          </div>

          <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>I agree to these terms and conditions.</span>
          </label>
        </Card>
      </div>
    </div>
  );
}
