import { useNavigation } from '@react-navigation/native';
import { ApplicationContext } from '@Root/ApplicationContext';
import { SCREEN_NOTES, SCREEN_SETTINGS } from '@Screens/screens';
import {
  ApplicationEvent,
  ButtonType,
  isSameDay,
  SNNote,
  StorageEncryptionPolicies,
} from '@standardnotes/snjs';
import React, { useCallback, useEffect } from 'react';
import { LockStateType } from './application_state';
import { Editor } from './editor';

export const useSignedIn = (
  signedInCallback?: () => void,
  signedOutCallback?: () => void
) => {
  // Context
  const application = React.useContext(ApplicationContext);

  const [isLocked] = useIsLocked();

  // State
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const getSignedIn = async () => {
      if (mounted && !isLocked) {
        setSignedIn(!application?.noAccount());
      }
    };
    getSignedIn();
    const removeSignedInObserver = application?.addEventObserver(
      async event => {
        if (event === ApplicationEvent.Launched) {
          getSignedIn();
        }
        if (event === ApplicationEvent.SignedIn) {
          setSignedIn(true);
          signedInCallback && signedInCallback();
        } else if (event === ApplicationEvent.SignedOut) {
          setSignedIn(false);
          signedOutCallback && signedOutCallback();
        }
      }
    );

    return () => {
      mounted = false;
      removeSignedInObserver && removeSignedInObserver();
    };
  }, [application, signedInCallback, signedOutCallback, isLocked]);

  return [signedIn];
};

export const useOutOfSync = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  // State
  const [outOfSync, setOutOfSync] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isMounted = true;
    const getOutOfSync = async () => {
      const outOfSyncInitial = await application?.isOutOfSync();
      if (isMounted) {
        setOutOfSync(Boolean(outOfSyncInitial));
      }
    };
    getOutOfSync();
    return () => {
      isMounted = false;
    };
  }, [application]);

  React.useEffect(() => {
    const removeSignedInObserver = application?.addEventObserver(
      async event => {
        if (event === ApplicationEvent.EnteredOutOfSync) {
          setOutOfSync(true);
        } else if (event === ApplicationEvent.ExitedOutOfSync) {
          setOutOfSync(false);
        }
      }
    );

    return removeSignedInObserver;
  }, [application]);

  return [outOfSync];
};

export const useIsLocked = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  // State
  const [isLocked, setIsLocked] = React.useState<boolean>(() =>
    Boolean(application?.getAppState().locked)
  );

  useEffect(() => {
    let isMounted = true;
    const removeSignedInObserver = application
      ?.getAppState()
      .addLockStateChangeObserver(event => {
        if (isMounted) {
          if (event === LockStateType.Locked) {
            setIsLocked(true);
          }
          if (event === LockStateType.Unlocked) {
            setIsLocked(false);
          }
        }
      });

    return () => {
      isMounted = false;
      removeSignedInObserver && removeSignedInObserver();
    };
  }, [application]);

  return [isLocked];
};

export const useHasEditor = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  // State
  const [hasEditor, setHasEditor] = React.useState<boolean>(false);

  useEffect(() => {
    const removeEditorObserver = application?.editorGroup.addChangeObserver(
      newEditor => {
        setHasEditor(Boolean(newEditor));
      }
    );
    return removeEditorObserver;
  }, [application]);

  return [hasEditor];
};

export const useSyncStatus = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  // State
  const [completedInitialSync, setCompletedInitialSync] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [decrypting, setDecrypting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const setStatus = useCallback(
    (status?: string, color?: string) => {
      application
        ?.getStatusManager()
        .setMessage(SCREEN_NOTES, status ?? '', color);
    },
    [application]
  );

  useEffect(() => {
    let mounted = true;
    const isEncryptionAvailable =
      application!.isEncryptionAvailable() &&
      application!.getStorageEncryptionPolicy() ===
        StorageEncryptionPolicies.Default;
    if (mounted) {
      setDecrypting(!completedInitialSync && isEncryptionAvailable);
      setLoading(!completedInitialSync && !isEncryptionAvailable);
    }
    return () => {
      mounted = false;
    };
  }, [application, completedInitialSync]);

  const updateLocalDataStatus = useCallback(() => {
    const syncStatus = application!.getSyncStatus();
    const stats = syncStatus.getStats();
    const encryption =
      application!.isEncryptionAvailable() &&
      application!.getStorageEncryptionPolicy() ===
        StorageEncryptionPolicies.Default;
    if (stats.localDataDone) {
      setStatus();
    }
    const notesString = `${stats.localDataCurrent}/${stats.localDataTotal} items...`;
    const loadingStatus = encryption
      ? `Decrypting ${notesString}`
      : `Loading ${notesString}`;
    setStatus(loadingStatus);
  }, [application, setStatus]);

  const updateSyncStatus = useCallback(() => {
    const syncStatus = application!.getSyncStatus();
    const stats = syncStatus.getStats();
    if (syncStatus.hasError()) {
      setRefreshing(false);
      setStatus('Unable to Sync');
    } else if (stats.downloadCount > 20) {
      const text = `Downloading ${stats.downloadCount} items. Keep app open.`;
      setStatus(text);
    } else if (stats.uploadTotalCount > 20) {
      setStatus(
        `Syncing ${stats.uploadCompletionCount}/${stats.uploadTotalCount} items...`
      );
    } else if (!syncStatus.syncInProgress) {
      setStatus();
    }
  }, [application, setStatus]);

  useEffect(() => {
    const unsubscribeAppEvents = application?.addEventObserver(
      async eventName => {
        if (eventName === ApplicationEvent.LocalDataIncrementalLoad) {
          updateLocalDataStatus();
        } else if (
          eventName === ApplicationEvent.SyncStatusChanged ||
          eventName === ApplicationEvent.FailedSync
        ) {
          updateSyncStatus();
        } else if (eventName === ApplicationEvent.LocalDataLoaded) {
          setDecrypting(false);
          setLoading(false);
          updateLocalDataStatus();
        } else if (eventName === ApplicationEvent.WillSync) {
          if (application.hasAccount() && !completedInitialSync) {
            requestAnimationFrame(() => {
              setStatus('Syncing...');
            });
          }
        } else if (eventName === ApplicationEvent.CompletedFullSync) {
          if (
            !completedInitialSync ||
            !application?.getAppState().isInTabletMode
          ) {
            setStatus();
          }
          if (!completedInitialSync) {
            setCompletedInitialSync(true);
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        } else if (eventName === ApplicationEvent.LocalDatabaseReadError) {
          application!.alertService!.alert(
            'Unable to load local storage. Please restart the app and try again.'
          );
        } else if (eventName === ApplicationEvent.LocalDatabaseWriteError) {
          application!.alertService!.alert(
            'Unable to write to local storage. Please restart the app and try again.'
          );
        } else if (eventName === ApplicationEvent.SignedIn) {
          setLoading(true);
        }
      }
    );

    return unsubscribeAppEvents;
  }, [
    application,
    completedInitialSync,
    setStatus,
    updateLocalDataStatus,
    updateSyncStatus,
  ]);

  const startRefreshing = () => {
    setRefreshing(true);
  };

  return [loading, decrypting, refreshing, startRefreshing] as [
    boolean,
    boolean,
    boolean,
    () => void
  ];
};

export const useDeleteNoteWithPrivileges = (
  note: SNNote,
  onDeleteCallback: () => void,
  onTrashCallback: () => void,
  editor?: Editor
) => {
  // Context
  const application = React.useContext(ApplicationContext);

  const trashNote = useCallback(async () => {
    const title = 'Move to Trash';
    const message = 'Are you sure you want to move this note to the trash?';

    const confirmed = await application?.alertService?.confirm(
      message,
      title,
      'Confirm',
      ButtonType.Danger
    );
    if (confirmed) {
      onTrashCallback();
    }
  }, [application?.alertService, onTrashCallback]);

  const deleteNotePermanently = useCallback(async () => {
    const title = `Delete ${note!.safeTitle()}`;
    const message = 'Are you sure you want to permanently delete this note?';
    if (editor?.isTemplateNote) {
      application?.alertService!.alert(
        'This note is a placeholder and cannot be deleted. To remove from your list, simply navigate to a different note.'
      );
      return;
    }
    const confirmed = await application?.alertService?.confirm(
      message,
      title,
      'Delete',
      ButtonType.Danger,
      'Cancel'
    );
    if (confirmed) {
      onDeleteCallback();
    }
  }, [
    application?.alertService,
    editor?.isTemplateNote,
    note,
    onDeleteCallback,
  ]);

  const deleteNote = useCallback(
    async (permanently: boolean) => {
      if (note?.locked) {
        application?.alertService.alert(
          "This note is locked. If you'd like to delete it, unlock it, and try again."
        );
        return;
      }
      if (permanently) {
        deleteNotePermanently();
      } else {
        trashNote();
      }
    },
    [application, deleteNotePermanently, note?.locked, trashNote]
  );

  return [deleteNote];
};

export const useProtectionSessionExpiry = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  const getProtectionsDisabledUntil = React.useCallback(() => {
    const protectionExpiry = application?.getProtectionSessionExpiryDate();
    const now = new Date();

    if (protectionExpiry && protectionExpiry > now) {
      let f: Intl.DateTimeFormat;

      if (isSameDay(protectionExpiry, now)) {
        f = new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: 'numeric',
        });
      } else {
        f = new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: 'numeric',
        });
      }

      return f.format(protectionExpiry);
    }
    return null;
  }, [application]);

  // State
  const [
    protectionsDisabledUntil,
    setProtectionsDisabledUntil,
  ] = React.useState(getProtectionsDisabledUntil());

  useEffect(() => {
    const removeProtectionLengthSubscriber = application?.addEventObserver(
      async event => {
        if (event === ApplicationEvent.ProtectionSessionExpiryDateChanged) {
          setProtectionsDisabledUntil(getProtectionsDisabledUntil());
        }
      }
    );
    return () => {
      removeProtectionLengthSubscriber && removeProtectionLengthSubscriber();
    };
  }, [application, getProtectionsDisabledUntil]);

  return [protectionsDisabledUntil];
};

export const useProtectNoteAlert = () => {
  // Context
  const application = React.useContext(ApplicationContext);

  const navigation = useNavigation();

  const showProtectNoteAlert = useCallback(
    async protectedNote => {
      if (
        !protectedNote &&
        !application?.protectionService?.hasProtectionSources()
      ) {
        const confirmed = await application?.alertService.confirm(
          'In order to Protect a note, you must add an application passcode or enable biometrics.',
          undefined,
          'Go to Settings'
        );

        if (confirmed) {
          navigation.navigate(SCREEN_SETTINGS);
        }
      }
    },
    [application, navigation]
  );

  return [showProtectNoteAlert];
};
