import { ButtonCell } from '@Components/ButtonCell';
import { SectionedTableCell } from '@Components/SectionedTableCell';
import { TableSection } from '@Components/TableSection';
import { ModalStackNavigationProp } from '@Root/App';
import { ApplicationContext } from '@Root/ApplicationContext';
import { SCREEN_INPUT_MODAL_PASSCODE } from '@Screens/screens';
import { StyleKitContext } from '@Style/StyleKit';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { SNItem } from 'snjs';
import { BaseText, Container, Input } from './InputModal.styled';

type Props = ModalStackNavigationProp<typeof SCREEN_INPUT_MODAL_PASSCODE>;
export const KeyRecoveryInputModal = (props: Props) => {
  // Context
  const application = useContext(ApplicationContext);
  const styleKit = useContext(StyleKitContext);

  // State
  const [pending, setPending] = useState(false);
  const [text, setText] = useState('');
  const [allItems, setAllItems] = useState<SNItem[] | undefined>(() =>
    application?.allItems()
  );
  const [encryptedItemsLength, setEncryptedItemsLength] = useState(0);

  // Refs
  const textRef = useRef<TextInput>(null);

  useEffect(() => {
    setEncryptedItemsLength(
      allItems?.filter(el => el.errorDecrypting).length ?? 0
    );
  }, [allItems]);

  const onSubmit = async () => {
    if (pending) {
      return;
    }

    setPending(true);
    const result = await application?.validatePasscode(text);
    console.log(result);
    setPending(false);
  };

  return (
    <Container>
      <TableSection>
        <SectionedTableCell first={true}>
          <BaseText>
            {encryptedItemsLength} items are encrypted and missing keys. This
            can occur as a result of a device cloud restore. Please enter the
            value of your local passcode as it was before the restore. We'll be
            able to determine if it is correct based on its ability to decrypt
            your items.
          </BaseText>
        </SectionedTableCell>
        <SectionedTableCell textInputCell first={true}>
          <Input
            ref={textRef}
            placeholder="Enter local passcode"
            onChangeText={setText}
            value={text}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize={'none'}
            keyboardAppearance={styleKit?.keyboardColorForActiveTheme()}
            autoFocus={true}
            underlineColorAndroid={'transparent'}
            onSubmitEditing={onSubmit}
          />
        </SectionedTableCell>

        <ButtonCell
          maxHeight={45}
          disabled={pending || text.length === 0}
          title={'Submit'}
          bold
          onPress={onSubmit}
        />
      </TableSection>
    </Container>
  );
};
