from datetime import datetime, timedelta
from pylon.core.tools import web, log

from ..models.pd.config_pd import ModelsConfig
from tools import rpc_tools, db, VaultClient, auth, api_tools


TOKEN_NAME = 'ai_token'


class RPC:

    @web.rpc('prompts_get_config', 'get_config')
    def get_config(self, project_id: int, user_id: int, **kwargs) -> ModelsConfig:
        secrets = VaultClient(project_id).get_all_secrets()
        url = ''.join([
            secrets['galloper_url'],
            secrets.get('ai_project_api_url', '/api/v1/prompts')
        ])

        all_tokens = auth.list_tokens(
            user_id=user_id,
            name=TOKEN_NAME
        )
        try:
            token = all_tokens[0]
            token = auth.encode_token(token['id'])
        except IndexError:
            token = None

        ai_integrations = self.context.rpc_manager.call.integrations_get_all_integrations_by_section(
            project_id=project_id,
            section_name='ai'
        )

        data = ModelsConfig(
            url=url,
            project_id=project_id,
            token=token,
            integrations=[i.dict(include={'uid', 'name', 'is_default', 'config'}) for i in ai_integrations]
        )
        return data

    @web.rpc('prompts_regenerate_token', 'regenerate_token')
    def regenerate_token(self, user_id: int) -> str:
        all_tokens = auth.list_tokens(
            user_id=user_id,
            name=TOKEN_NAME
        )
        for i in all_tokens:
            auth.delete_token(token_id=i['id'])

        token_id = auth.add_token(
            user_id=user_id,
            name=TOKEN_NAME,
            expires=datetime.now() + timedelta(days=30),
        )

        return auth.encode_token(token_id)
