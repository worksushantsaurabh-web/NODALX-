INSERT INTO storage.buckets(id, name, public, file_size_limit)
VALUES ('workspace-artifacts', 'workspace-artifacts', false, 10485760);

CREATE POLICY nodalx_artifact_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'workspace-artifacts'
  AND EXISTS (
    SELECT 1 FROM public.artifacts artifact
    WHERE artifact.workspace_id = (SELECT private.current_workspace_id())
      AND artifact.object_path = storage.objects.name
      AND (artifact.expires_at IS NULL OR artifact.expires_at > now())
  )
);
